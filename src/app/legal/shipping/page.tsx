// app/(main)/legal/shipping/page.tsx
export default function ShippingPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 pt-8 pb-16">
      <h1 className="text-4xl font-bold text-white mb-4">
        Shipping Policy - Realdealkickzsc
      </h1>

      <div className="prose prose-invert max-w-none">
        <div className="text-zinc-400 space-y-6">
          <p className="text-sm">Last updated: December 30, 2025</p>
          <p>
            This Shipping Policy applies to purchases arranged directly with
            Realdealkickzsc after browsing realdealkickzsc.com. The website does not
            accept payments or place orders.
          </p>

          <section>
            <h2 className="text-2xl font-bold text-white mt-8 mb-4">
              1) Processing Time (When We Ship)
            </h2>
            <p>
              We aim to ship orders within 24 hours of the order being placed, unless
              stated otherwise, and provided no unforeseen events occur that prevent
              shipment in that timeframe.
            </p>
            <p>Important clarifications:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>
                &quot;Within 24 hours&quot; refers to processing time, not delivery time.
              </li>
              <li>
                Processing time may be measured in business hours and may be affected by
                weekends and holidays.
              </li>
              <li>
                Some orders may require additional time for verification (for example,
                fraud prevention or address confirmation).
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mt-8 mb-4">
              2) Exceptions (When Shipping May Take Longer)
            </h2>
            <p>
              Shipping may take longer than 24 hours in cases including, but not limited
              to:
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>holidays or weekends</li>
              <li>weather events or natural disasters</li>
              <li>carrier disruptions, delays, or service outages</li>
              <li>high order volume</li>
              <li>address issues (incomplete or incorrect address)</li>
              <li>payment review or fraud-prevention checks</li>
              <li>
                product-specific notes such as &quot;pre-order,&quot; &quot;delayed,&quot;
                or &quot;ships later&quot; (when stated on the listing or in our messages)
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mt-8 mb-4">
              3) Shipping Rates and Methods
            </h2>
            <p>
              Shipping options and rates are agreed directly with us before payment. The
              shipping method you choose affects transit time, not our processing time.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mt-8 mb-4">4) Tracking</h2>
            <p>
              When available, we will provide tracking information once your order ships.
              Tracking updates may take time to appear after carrier acceptance.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mt-8 mb-4">
              5) Delivery Times and Carrier Responsibility
            </h2>
            <p>
              Delivery dates are estimates and are not guaranteed. After a package is
              handed to the carrier, delivery speed and handling are the carrier&apos;s
              responsibility (except where applicable law provides otherwise).
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mt-8 mb-4">
              6) Address Accuracy
            </h2>
            <p>
              You are responsible for providing a complete and accurate shipping address
              directly to us. If an order is returned or delayed due to an incorrect or
              incomplete address, additional shipping charges may apply to reship.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mt-8 mb-4">7) Questions</h2>
            <p>If you have any shipping questions, contact us at:</p>
            <p className="mt-2">
              Email: realdealholyspill@gmail.com
              <br />
              Location: Simpsonville, South Carolina, USA
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
