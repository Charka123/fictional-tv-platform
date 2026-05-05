import { prisma } from "./lib/prisma";
import Link from "next/link";
import { revalidatePath } from "next/cache";

export default async function Home() {
  // 1. Fetch data directly from the database
  const stations = await prisma.station.findMany({
    include: {
      _count: {
        select: { channels: true }, // This lets us show how many channels each station has
      },
    },
  });

  // 2. Define the logic to create a station (Inline Server Action)
  async function createStation(formData: FormData) {
    "use server";
    const name = formData.get("name") as string;
    
    // For now, we create/find a default user to own the station
    const user = await prisma.user.upsert({
      where: { id: 'admin-id' }, // Just for development
      update: {},
      create: { id: 'admin-id', name: 'Admin' }
    });

    await prisma.station.create({
      data: {
        name,
        ownerId: user.id,
      },
    });

    revalidatePath("/"); // Tells Next.js to refresh the list
  }

  return (
    <main className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6 text-white-900">
        Fictional Radio & TV Station Management Platform
      </h1>
      
      <div className="grid gap-6">
        {/* Quick Actions Section */}
        <section className="p-6 border rounded-lg bg-slate-50 shadow-sm">
          <h2 className="text-xl font-semibold mb-4 text-black">Management Console</h2>
          <form action={createStation} className="flex gap-4">
            <input 
              name="name"
              required
              placeholder="Enter the name of the station." 
              className="flex-1 px-4 py-2 border rounded-md text-black"
            />
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors">
              Create
            </button>
          </form>
        </section>

        {/* Station List Section */}
        <section className="p-6 border rounded-lg">
          <h2 className="text-xl font-semibold mb-4 text-white">My Stations</h2>
          
          {stations.length === 0 ? (
            <p className="text-gray-500 italic">No TV stations, create one above</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {stations.map((station) => (
                <div key={station.id} className="p-4 border rounded-lg hover:border-blue-300 transition-all bg-white shadow-sm flex flex-col justify-between">
                  <div>
                    <h3 className="font-bold text-lg text-black">{station.name}</h3>
                    <p className="text-sm text-gray-500">{station._count.channels} channels</p>
                  </div>
                  <Link
                  href={`/stations/${station.id}`}
                  className="mt-4 text-sm font-medium text-blue-600 hover:text-blue-800 text-left"
                  >
                  Enter console →
                </Link>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}