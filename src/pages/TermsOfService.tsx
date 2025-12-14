import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const TermsOfService: React.FC = () => {
  const navigate = useNavigate();

  // Scroll to top when this page mounts
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
  }, []);

  const handleBack = () => {
    navigate(-1); // Go back to previous route
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Fixed Back Button */}
      <button
        type="button"
        onClick={handleBack}
        className="fixed top-4 left-4 z-50 px-4 py-2 border border-gray-300 rounded bg-white text-gray-700 hover:bg-gray-50 transition-colors"
      >
        ← Back
      </button>

      {/* Header */}
      <header className="py-6 bg-slate-800">
        <div className="container mx-auto px-4">
          <h1 className="text-center text-white text-3xl font-bold">
            BuyAPixel - Terms of Service
          </h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-12">
        <div className="flex justify-center">
          <div className="w-full lg:w-5/6">
            <div className="bg-white rounded-lg shadow-sm">
              <div className="p-6 md:p-10">
                {/* Last Updated */}
                <div className="mb-6 p-4 bg-blue-50 border-l-4 border-blue-500 text-slate-800">
                  <strong>Last Updated:</strong> December 10, 2025
                </div>

                {/* Introduction */}
                <section className="mb-8">
                  <h2 className="text-xl font-semibold text-slate-800 pb-2 mb-4 border-b-2 border-blue-500">
                    1. Agreement to Terms
                  </h2>
                  <p className="text-slate-700 leading-relaxed">
                    By accessing and using BuyAPixel ("the Website"), you agree
                    to be bound by these Terms of Service. BuyAPixel is a pixel
                    advertising platform where users can purchase pixel blocks
                    to display their advertisements permanently on our homepage.
                    If you do not agree to these terms, please do not use our
                    service.
                  </p>
                </section>

                {/* Service Description */}
                <section className="mb-8">
                  <h2 className="text-xl font-semibold text-slate-800 pb-2 mb-4 border-b-2 border-blue-500">
                    2. Service Description
                  </h2>
                  <p className="text-slate-700 leading-relaxed mb-3">
                    BuyAPixel operates as a digital advertising platform
                    offering a pixel grid for purchase. Users can buy pixel
                    blocks (minimum 10×10 pixels) at the rate of $1 per pixel to
                    display their logos, images, or advertisements with
                    clickable links to their websites.
                  </p>
                  <ul className="list-disc pl-6 text-slate-700 leading-relaxed space-y-2">
                    <li>Each pixel block purchase is a one-time fee.</li>
                    <li>
                      Purchased pixels remain visible for the lifetime of the
                      website.
                    </li>
                    <li>Minimum purchase is 100 pixels (10×10 block).</li>
                    <li>All purchases are final and non-refundable.</li>
                  </ul>
                </section>

                {/* User Obligations */}
                <section className="mb-8">
                  <h2 className="text-xl font-semibold text-slate-800 pb-2 mb-4 border-b-2 border-blue-500">
                    3. User Obligations and Acceptable Use
                  </h2>
                  <p className="text-slate-700 leading-relaxed mb-3">
                    When using BuyAPixel, you agree to:
                  </p>
                  <ul className="list-disc pl-6 text-slate-700 leading-relaxed space-y-2">
                    <li>
                      Provide accurate and complete information during purchase.
                    </li>
                    <li>
                      Submit only legal, appropriate, and non-offensive content.
                    </li>
                    <li>
                      Ensure your advertisement complies with all applicable
                      laws.
                    </li>
                    <li>Respect intellectual property rights of others.</li>
                  </ul>
                  <div className="mt-4 p-4 bg-yellow-50 border-l-4 border-yellow-400 text-yellow-800">
                    <strong>Prohibited Content:</strong> We do not accept
                    advertisements containing or promoting illegal activities,
                    adult content, hate speech, violence, malware, scams, or any
                    content that violates applicable laws.
                  </div>
                </section>

                {/* Payment Terms */}
                <section className="mb-8">
                  <h2 className="text-xl font-semibold text-slate-800 pb-2 mb-4 border-b-2 border-blue-500">
                    4. Payment and Pricing
                  </h2>
                  <p className="text-slate-700 leading-relaxed mb-3">
                    Pixel blocks are sold at $1 USD per pixel with a minimum
                    purchase of 100 pixels. All payments must be made in full
                    before your advertisement is displayed. We accept major
                    credit cards and other payment methods as specified on our
                    payment page.
                  </p>
                  <p className="text-slate-700 leading-relaxed">
                    <strong>Refund Policy:</strong> All sales are final. Due to
                    the permanent nature of pixel placement, we do not offer
                    refunds once your advertisement has been published on the
                    Website.
                  </p>
                </section>

                {/* Intellectual Property */}
                <section className="mb-8">
                  <h2 className="text-xl font-semibold text-slate-800 pb-2 mb-4 border-b-2 border-blue-500">
                    5. Intellectual Property Rights
                  </h2>
                  <p className="text-slate-700 leading-relaxed mb-3">
                    You retain all rights to the content you submit. By
                    uploading your advertisement, you grant BuyAPixel a
                    non-exclusive, worldwide, royalty-free license to display
                    your content on our platform. You represent and warrant that
                    you own or have the necessary rights to all content you
                    submit.
                  </p>
                  <p className="text-slate-700 leading-relaxed">
                    The BuyAPixel website design, layout, and branding are
                    protected by copyright and trademark laws. Unauthorized use
                    is prohibited.
                  </p>
                </section>

                {/* Content Moderation */}
                <section className="mb-8">
                  <h2 className="text-xl font-semibold text-slate-800 pb-2 mb-4 border-b-2 border-blue-500">
                    6. Content Review and Removal
                  </h2>
                  <p className="text-slate-700 leading-relaxed">
                    BuyAPixel reserves the right to review all submitted content
                    before publication. We may reject or remove any
                    advertisement that violates these Terms of Service, contains
                    prohibited content, or is deemed inappropriate at our sole
                    discretion. In cases of content removal for policy
                    violations, no refund will be issued.
                  </p>
                </section>

                {/* Limitation of Liability */}
                <section className="mb-8">
                  <h2 className="text-xl font-semibold text-slate-800 pb-2 mb-4 border-b-2 border-blue-500">
                    7. Limitation of Liability
                  </h2>
                  <p className="text-slate-700 leading-relaxed mb-3">
                    BuyAPixel is provided "as is" without warranties of any
                    kind. We are not liable for any damages arising from your
                    use of the Website, including but not limited to direct,
                    indirect, incidental, or consequential damages. This
                    includes loss of profits, data, or business opportunities.
                  </p>
                  <p className="text-slate-700 leading-relaxed">
                    While we strive to maintain continuous service, we do not
                    guarantee uninterrupted access to the Website. We are not
                    responsible for the content or practices of third-party
                    websites linked through user advertisements.
                  </p>
                </section>

                {/* Privacy and Data */}
                <section className="mb-8">
                  <h2 className="text-xl font-semibold text-slate-800 pb-2 mb-4 border-b-2 border-blue-500">
                    8. Privacy and Data Collection
                  </h2>
                  <p className="text-slate-700 leading-relaxed">
                    Your use of BuyAPixel is also governed by our Privacy
                    Policy. We collect and process personal information
                    necessary to provide our services, including payment
                    information and contact details. By using our service, you
                    consent to our data practices as described in our Privacy
                    Policy.
                  </p>
                </section>

                {/* Termination */}
                <section className="mb-8">
                  <h2 className="text-xl font-semibold text-slate-800 pb-2 mb-4 border-b-2 border-blue-500">
                    9. Termination and Account Suspension
                  </h2>
                  <p className="text-slate-700 leading-relaxed">
                    BuyAPixel reserves the right to suspend or terminate access
                    to our services for any user who violates these Terms of
                    Service. We may also terminate or modify our services at any
                    time with reasonable notice. Upon termination, your right to
                    use the Website ceases immediately.
                  </p>
                </section>

                {/* Dispute Resolution */}
                <section className="mb-8">
                  <h2 className="text-xl font-semibold text-slate-800 pb-2 mb-4 border-b-2 border-blue-500">
                    10. Dispute Resolution and Governing Law
                  </h2>
                  <p className="text-slate-700 leading-relaxed mb-3">
                    Any disputes arising from these Terms of Service or your use
                    of BuyAPixel shall be resolved through binding arbitration
                    in accordance with the rules of the American Arbitration
                    Association. These terms are governed by the laws of [Your
                    Jurisdiction], without regard to conflict of law principles.
                  </p>
                  <p className="text-slate-700 leading-relaxed">
                    You agree that any legal action must be commenced within one
                    year after the claim arose.
                  </p>
                </section>

                {/* Changes to Terms */}
                <section className="mb-8">
                  <h2 className="text-xl font-semibold text-slate-800 pb-2 mb-4 border-b-2 border-blue-500">
                    11. Changes to Terms of Service
                  </h2>
                  <p className="text-slate-700 leading-relaxed">
                    We reserve the right to modify these Terms of Service at any
                    time. Changes will be effective immediately upon posting to
                    the Website. Your continued use of BuyAPixel after changes
                    constitutes acceptance of the modified terms. We encourage
                    you to review these terms periodically.
                  </p>
                </section>

                {/* Contact Information */}
                <section className="mb-6">
                  <h2 className="text-xl font-semibold text-slate-800 pb-2 mb-4 border-b-2 border-blue-500">
                    12. Contact Information
                  </h2>
                  <p className="text-slate-700 leading-relaxed mb-3">
                    If you have questions about these Terms of Service, please
                    contact us at:
                  </p>
                  <div className="p-4 bg-gray-100 rounded">
                    <p className="mb-2 text-slate-800">
                      <strong>BuyAPixel</strong>
                    </p>
                    <p className="mb-2 text-slate-800">
                      Email: legal@buyapixel.com
                    </p>
                    <p className="mb-0 text-slate-800">
                      Support: support@buyapixel.com
                    </p>
                  </div>
                </section>

                {/* Acceptance */}
                <div className="p-4 bg-green-50 border-l-4 border-green-500 text-green-800">
                  <strong>
                    By using BuyAPixel, you acknowledge that you have read,
                    understood, and agree to be bound by these Terms of
                    Service.
                  </strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 mt-12 bg-gray-700">
        <div className="container mx-auto px-4">
          <p className="text-center text-gray-200">
            © 2025 BuyAPixel. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default TermsOfService;
