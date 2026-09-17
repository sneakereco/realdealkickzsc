// app/hours/page.tsx
export default function HoursPage() {
  return (
    <div className="max-w-6xl mx-auto px-4 pt-8 pb-16">
      <h1 className="text-4xl font-bold text-white mb-4">Hours</h1>
      <p className="text-zinc-400 mb-4">
        Pickup and meetup available in Simpsonville, South Carolina. Local pickups are
        available by arrangement when you message us on Instagram.
      </p>
      <p className="text-zinc-400 mb-10">
        We are always looking to buy sneakers no matter the condition and no matter the
        quantity. If you are interested in selling, reach out on{" "}
        <a
          href="https://instagram.com/realdealkickzsc"
          target="_blank"
          rel="noopener noreferrer"
          className="text-red-400 hover:underline"
        >
          Instagram
        </a>
        ,{" "}
        <a
          href="mailto:realdealholyspill@gmail.com"
          className="text-red-400 hover:underline"
        >
          email us
        </a>
        , submit through the{" "}
        <a href="/contact" className="text-red-400 hover:underline">
          contact form
        </a>
        , or use the{" "}
        <a href="/account" className="text-red-400 hover:underline">
          onsite messaging system
        </a>
        .
      </p>

      <div className="grid md:grid-cols-2 gap-8 items-stretch">
        <div className="bg-zinc-900 border border-zinc-800 p-8 h-full min-h-[360px] flex flex-col">
          <h2 className="text-2xl font-bold text-white mb-4">Business Hours</h2>
          <p className="text-zinc-400 mb-6">
            We offer local pickups and meetups by appointment.
          </p>
          <div className="space-y-2 text-zinc-400">
            <div className="flex justify-between">
              <span>Monday</span>
              <span>11:00 AM - 8:00 PM</span>
            </div>
            <div className="flex justify-between">
              <span>Tuesday</span>
              <span>11:00 AM - 8:00 PM</span>
            </div>
            <div className="flex justify-between">
              <span>Wednesday</span>
              <span>11:00 AM - 8:00 PM</span>
            </div>
            <div className="flex justify-between">
              <span>Thursday</span>
              <span>11:00 AM - 8:00 PM</span>
            </div>
            <div className="flex justify-between">
              <span>Friday</span>
              <span>11:00 AM - 8:00 PM</span>
            </div>
            <div className="flex justify-between">
              <span>Saturday</span>
              <span>11:00 AM - 8:00 PM</span>
            </div>
            <div className="flex justify-between">
              <span>Sunday</span>
              <span>Closed</span>
            </div>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 overflow-hidden h-full min-h-[360px]">
          <iframe
            title="Map of Simpsonville, South Carolina"
            src="https://www.openstreetmap.org/export/embed.html?bbox=-82.3326%2C34.6985%2C-82.1687%2C34.7876&layer=mapnik&marker=34.743%2C-82.2507"
            width="100%"
            height="360"
            style={{ border: 0 }}
            loading="lazy"
            className="w-full h-full"
          />
        </div>
      </div>
    </div>
  );
}
