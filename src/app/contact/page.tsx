// app/(main)/contact/page.tsx
import Image from "next/image";

export default function ContactPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 pt-8 pb-16">
      <h1 className="text-4xl font-bold text-white mb-4">Contact Us</h1>
      <div className="text-zinc-400 mb-12 space-y-4">
        <p>
          Trying to sell sneakers, clothing, accessories, or anything you think we might
          want? Reach out. We&apos;re always buying.
        </p>
        <p>
          You can contact us through the{" "}
          <a href="/account" className="text-red-400 hover:underline">
            onsite messaging system
          </a>
          , by emailing us at{" "}
          <a
            href="mailto:realdealholyspill@gmail.com"
            className="text-red-400 hover:underline"
          >
            realdealholyspill@gmail.com
          </a>
          , or by sending us a DM on Instagram at{" "}
          <a
            href="https://instagram.com/realdealkickzsc"
            target="_blank"
            rel="noopener noreferrer"
            className="text-red-400 hover:underline"
          >
            @realdealkickzsc
          </a>
          .
        </p>
        <p>
          Need help putting together a fit? We offer fit services too. Submit your size,
          style, and any specific colors, shoes, or clothing you want included, and we
          will build a full outfit for you. We will arrange purchase and delivery with you
          directly.
        </p>
        <p>Have questions or need anything else? Feel free to reach out.</p>
      </div>

      <div className="mx-auto max-w-2xl">
        <div className="hidden md:block">
          {/* Image stack (matches the reference orientation) */}
          <div className="relative h-full min-h-[420px] overflow-visible">
            {/* Front / left card */}
            <div className="absolute left-[8%] top-[6%] w-[64%] max-w-[340px] aspect-[3/4] border border-zinc-800 bg-black shadow-2xl -rotate-[12deg] overflow-hidden z-20">
              <Image
                src="/images/fits/fit-1.png"
                alt="Outfit styling example 1"
                fill
                sizes="(min-width: 768px) 26vw, 70vw"
                className="object-cover"
              />
            </div>

            {/* Back / right card */}
            <div className="absolute left-[40%] top-[20%] w-[58%] max-w-[320px] aspect-[3/4] border border-zinc-800 bg-black shadow-2xl rotate-[10deg] overflow-hidden z-10">
              <Image
                src="/images/fits/fit-2.png"
                alt="Outfit styling example 2"
                fill
                sizes="(min-width: 768px) 24vw, 70vw"
                className="object-cover"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
