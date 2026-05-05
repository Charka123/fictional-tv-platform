import { prisma } from "@/app/lib/prisma";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function ChannelEPGPage({
  params,
  searchParams,
}: {
  params: Promise<{ stationId: string; channelId: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const { stationId, channelId } = await params;
  const { date } = await searchParams;

  const selectedDate = date ?? new Date().toISOString().slice(0, 10);

  const dayStart = new Date(`${selectedDate}T00:00:00`);
  const dayEnd = new Date(`${selectedDate}T23:59:59`);

  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    include: {
      station: true,
      epgItems: {
        where: {
          startTime: {
            gte: dayStart,
            lte: dayEnd,
          },
        },
        orderBy: {
          startTime: "asc",
        },
      },
    },
  });

  if (!channel || channel.stationId !== stationId) {
    notFound();
  }

  async function createEPGItem(formData: FormData) {
    "use server";

    const programName = formData.get("programName") as string;
    const date = formData.get("date") as string;
    const time = formData.get("time") as string;
    const durationMinutes = Number(formData.get("durationMinutes"));

    await prisma.ePGItem.create({
      data: {
        channelId,
        programName,
        startTime: new Date(`${date}T${time}:00`),
        durationMinutes,
      },
    });

    revalidatePath(`/stations/${stationId}/channels/${channelId}`);
  }

  async function deleteEPGItem(formData: FormData) {
  "use server";

  const id = formData.get("id") as string;

  await prisma.ePGItem.delete({
    where: { id },
  });

  revalidatePath(`/stations/${stationId}/channels/${channelId}`);
}

async function importEPGItems(formData: FormData) {
  "use server";

  const date = formData.get("date") as string;
  const finalEndTime = formData.get("finalEndTime") as string;
  const rawText = formData.get("rawText") as string;

  const baseDate = new Date(`${date}T00:00:00`);

  const lines = rawText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const parsedRawItems = lines.map((line) => {
    const firstSpaceIndex = line.indexOf(" ");

    if (firstSpaceIndex === -1) {
      throw new Error(`Invalid line: ${line}`);
    }

    const time = line.slice(0, firstSpaceIndex);
    const programName = line.slice(firstSpaceIndex + 1).trim();

    return { time, programName };
  });

  let dayOffset = 0;
  let previousMinutes: number | null = null;

  const parsedItems = parsedRawItems.map((item) => {
    const [hour, minute] = item.time.split(":").map(Number);
    const currentMinutes = hour * 60 + minute;

    if (previousMinutes !== null && currentMinutes < previousMinutes) {
      dayOffset += 1;
    }

    previousMinutes = currentMinutes;

    const startTime = new Date(baseDate);
    startTime.setDate(baseDate.getDate() + dayOffset);
    startTime.setHours(hour, minute, 0, 0);

    return {
      programName: item.programName,
      startTime,
    };
  });

  const lastItem = parsedItems[parsedItems.length - 1];

  const [finalHour, finalMinute] = finalEndTime.split(":").map(Number);
  let finalEndDate = new Date(lastItem.startTime);
  finalEndDate.setHours(finalHour, finalMinute, 0, 0);

  if (finalEndDate <= lastItem.startTime) {
    finalEndDate.setDate(finalEndDate.getDate() + 1);
  }

  const itemsWithDuration = parsedItems.map((item, index) => {
    const nextItem = parsedItems[index + 1];

    const endTime = nextItem ? nextItem.startTime : finalEndDate;

    const durationMinutes = Math.round(
      (endTime.getTime() - item.startTime.getTime()) / 60000
    );

    if (durationMinutes <= 0) {
      throw new Error(`Invalid duration for: ${item.programName}`);
    }

    return {
      channelId,
      programName: item.programName,
      startTime: item.startTime,
      durationMinutes,
    };
  });

  await prisma.ePGItem.createMany({
    data: itemsWithDuration,
  });

  revalidatePath(`/stations/${stationId}/channels/${channelId}`);
}

  const previousDate = new Date(dayStart);
  previousDate.setDate(previousDate.getDate() - 1);

  const nextDate = new Date(dayStart);
  nextDate.setDate(nextDate.getDate() + 1);

  const previousDateString = previousDate.toISOString().slice(0, 10);
  const nextDateString = nextDate.toISOString().slice(0, 10);

  return (
    <main className="p-8 max-w-4xl mx-auto">
      <Link
        href={`/stations/${stationId}`}
        className="text-blue-500 hover:text-blue-700"
      >
        ← Back to station console
      </Link>

      <h1 className="text-3xl font-bold mt-6 mb-2 text-white">
        {channel.name} EPG
      </h1>

      <p className="text-gray-400 mb-6">{channel.station.name}</p>

      <section className="p-6 border rounded-lg bg-slate-50 shadow-sm mb-6">
        <h2 className="text-xl font-semibold mb-4 text-black">
          Create EPG Entry
        </h2>

        <form action={createEPGItem} className="grid gap-4">
          <input
            name="programName"
            required
            placeholder="Show name"
            className="px-4 py-2 border rounded-md text-black"
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input
              name="date"
              type="date"
              required
              defaultValue={selectedDate}
              className="px-4 py-2 border rounded-md text-black"
            />

            <input
              name="time"
              type="time"
              required
              className="px-4 py-2 border rounded-md text-black"
            />

            <input
              name="durationMinutes"
              type="number"
              min="1"
              required
              placeholder="Duration minutes"
              className="px-4 py-2 border rounded-md text-black"
            />
          </div>

          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Create
          </button>
        </form>
      </section>

      <section className="p-6 border rounded-lg bg-slate-50 shadow-sm mb-6">
  <h2 className="text-xl font-semibold mb-4 text-black">
    Import EPG for One Day
  </h2>

  <form action={importEPGItems} className="grid gap-4">
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <input
        name="date"
        type="date"
        required
        defaultValue={selectedDate}
        className="px-4 py-2 border rounded-md text-black"
      />

      <input
        name="finalEndTime"
        type="time"
        required
        className="px-4 py-2 border rounded-md text-black"
      />
    </div>

    <textarea
      name="rawText"
      required
      rows={8}
      placeholder={`00:21 锦绣南歌 17
01:06 锦绣南歌 18
01:52 锦绣南歌 19
02:37 魔力歌先生 8（上）（重播）`}
      className="px-4 py-2 border rounded-md text-black font-mono"
    />

    <button
      type="submit"
      className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
    >
      Import EPG
    </button>
  </form>
</section>

      <section className="p-6 border rounded-lg">
        <div className="flex items-center justify-between mb-6">
          <Link
            href={`/stations/${stationId}/channels/${channelId}?date=${previousDateString}`}
            className="text-blue-500"
          >
            ← Previous day
          </Link>

          <h2 className="text-xl font-semibold text-white">{selectedDate}</h2>

          <Link
            href={`/stations/${stationId}/channels/${channelId}?date=${nextDateString}`}
            className="text-blue-500"
          >
            Next day →
          </Link>
        </div>

        {channel.epgItems.length === 0 ? (
          <p className="text-gray-500 italic">No EPG entries for this day.</p>
        ) : (
          <div className="space-y-3">
            {channel.epgItems.map((item) => (
  <div
    key={item.id}
    className="p-4 bg-white rounded-lg shadow-sm flex items-center gap-6"
  >
    <div className="font-mono text-gray-600 w-24">
      {item.startTime.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })}
    </div>

    <div className="flex-1">
      <h3 className="font-bold text-black">{item.programName}</h3>
      <p className="text-sm text-gray-500">
        {item.durationMinutes} minutes
      </p>
    </div>

    <form action={deleteEPGItem}>
      <input type="hidden" name="id" value={item.id} />

      <button
        type="submit"
        className="px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700"
      >
        Delete
      </button>
    </form>
  </div>
))}
          </div>
        )}
      </section>
    </main>
  );
}