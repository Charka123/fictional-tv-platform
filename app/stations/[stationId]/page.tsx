import { prisma } from "@/app/lib/prisma";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function StationConsole({
  params,
}: {
  params: Promise<{ stationId: string }>;
}) {
  const { stationId } = await params;

  const station = await prisma.station.findUnique({
    where: { id: stationId },
    include: {
      channels: true,
    },
  });

  if (!station) {
    notFound();
  }

  async function createChannel(formData: FormData) {
    "use server";

    const name = formData.get("name") as string;

    await prisma.channel.create({
      data: {
        name,
        stationId,
      },
    });

    revalidatePath(`/stations/${stationId}`);
  }

  return (
    <main className="p-8 max-w-4xl mx-auto">
      <Link href="/" className="text-blue-500 hover:text-blue-700">
        ← Back to stations
      </Link>

      <h1 className="text-3xl font-bold mt-6 mb-6 text-white">
        {station.name} Console
      </h1>

      <section className="p-6 border rounded-lg bg-slate-50 shadow-sm mb-6">
        <h2 className="text-xl font-semibold mb-4 text-black">
          Create Channel
        </h2>

        <form action={createChannel} className="flex gap-4">
          <input
            name="name"
            required
            placeholder="Enter channel name."
            className="flex-1 px-4 py-2 border rounded-md text-black"
          />

          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Create
          </button>
        </form>
      </section>

      <section className="p-6 border rounded-lg">
  <h2 className="text-xl font-semibold mb-4 text-white">Channels</h2>

  {station.channels.length === 0 ? (
    <p className="text-gray-500 italic">No channels yet.</p>
  ) : (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {station.channels.map((channel) => (
        <Link
          key={channel.id}
          href={`/stations/${stationId}/channels/${channel.id}`}
          className="p-4 border rounded-lg bg-white shadow-sm hover:border-blue-300 transition-all"
        >
          <h3 className="font-bold text-lg text-black">{channel.name}</h3>
          <p className="text-sm text-blue-600 mt-2">Open EPG →</p>
        </Link>
      ))}
    </div>
  )}
</section>
    </main>
  );
}