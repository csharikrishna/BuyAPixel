import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const PrivacyPolicy: React.FC = () => {
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
            BuyAPixel – Privacy Policy
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

                {/* 1. Introduction */}
                <section className="mb-8">
                  <h2 className="text-xl font-semibold text-slate-800 pb-2 mb-4 border-b-2 border-blue-500">
                    1. Introduction
                  </h2>
                  <p className="text-slate-700 leading-relaxed">
                    This Privacy Policy explains how BuyAPixel ("we", "us", or
                    "our") collects, uses, discloses, and protects your personal
                    information when you access or use our website and services.
                    By using BuyAPixel, you agree to the collection and use of
                    information in accordance with this Privacy Policy.
                  </p>
                </section>

                {/* 2. Information We Collect */}
                <section className="mb-8">
                  <h2 className="text-xl font-semibold text-slate-800 pb-2 mb-4 border-b-2 border-blue-500">
                    2. Information We Collect
                  </h2>
                  <p className="text-slate-700 leading-relaxed mb-3">
                    We collect information that you provide directly to us, as
                    well as data collected automatically when you use our
                    website.
                  </p>
                  <ul className="list-disc pl-6 text-slate-700 leading-relaxed space-y-2">
                    <li>
                      <strong>Account and Contact Data:</strong> Name, email
                      address, password, and profile details you submit when
                      creating an account or contacting us.
                    </li>
                    <li>
                      <strong>Payment Information:</strong> Billing details and
                      transaction data processed via our payment providers
                      (card numbers are handled by third‑party processors, not
                      stored by us).
                    </li>
                    <li>
                      <strong>Usage Data:</strong> IP address, browser type,
                      device information, pages visited, time and date of visit,
                      and other analytics data.
                    </li>
                    <li>
                      <strong>Advertising and Pixel Data:</strong> Information
                      related to the pixel blocks you purchase, linked URLs,
                      images, and interaction data with your ads.
                    </li>
                  </ul>
                </section>

                {/* 3. How We Use Your Information */}
                <section className="mb-8">
                  <h2 className="text-xl font-semibold text-slate-800 pb-2 mb-4 border-b-2 border-blue-500">
                    3. How We Use Your Information
                  </h2>
                  <p className="text-slate-700 leading-relaxed mb-3">
                    We use the information we collect for specific, clearly
                    defined purposes.
                  </p>
                  <ul className="list-disc pl-6 text-slate-700 leading-relaxed space-y-2">
                    <li>To create and manage your account and purchases.</li>
                    <li>To process payments and prevent fraud.</li>
                    <li>
                      To operate, maintain, and improve our website and
                      services.
                    </li>
                    <li>
                      To display your purchased pixel ads and related content.
                    </li>
                    <li>
                      To provide customer support and respond to your requests.
                    </li>
                    <li>
                      To send service‑related communications, updates, and
                      important notices.
                    </li>
                    <li>
                      To perform analytics, monitor usage, and improve user
                      experience.
                    </li>
                  </ul>
                </section>

                {/* 4. Cookies and Tracking Technologies */}
                <section className="mb-8">
                  <h2 className="text-xl font-semibold text-slate-800 pb-2 mb-4 border-b-2 border-blue-500">
                    4. Cookies and Tracking Technologies
                  </h2>
                  <p className="text-slate-700 leading-relaxed mb-3">
                    We use cookies and similar technologies to recognize your
                    browser, remember your preferences, and analyze how you
                    interact with our website.
                  </p>
                  <ul className="list-disc pl-6 text-slate-700 leading-relaxed space-y-2">
                    <li>
                      <strong>Essential cookies:</strong> Required for core
                      site functionality, such as security and session
                      management.
                    </li>
                    <li>
                      <strong>Analytics cookies:</strong> Help us understand how
                      users navigate the site so we can improve performance.
                    </li>
                    <li>
                      <strong>Advertising and tracking pixels:</strong> May be
                      used to measure ad performance and deliver relevant
                      content, subject to your consent where required by law.
                    </li>
                  </ul>
                  <p className="text-slate-700 leading-relaxed mt-3">
                    Where required, we will obtain your consent before setting
                    non‑essential cookies and provide options to manage or
                    withdraw consent at any time.
                  </p>
                </section>

                {/* 5. Legal Bases (if applicable) */}
                <section className="mb-8">
                  <h2 className="text-xl font-semibold text-slate-800 pb-2 mb-4 border-b-2 border-blue-500">
                    5. Legal Bases for Processing
                  </h2>
                  <p className="text-slate-700 leading-relaxed mb-3">
                    Where applicable data protection laws require it, we process
                    your personal data based on one or more of the following
                    legal bases:
                  </p>
                  <ul className="list-disc pl-6 text-slate-700 leading-relaxed space-y-2">
                    <li>Your consent (for example, for certain cookies or marketing).</li>
                    <li>
                      Performance of a contract (to provide the services you
                      requested, such as pixel purchases).
                    </li>
                    <li>
                      Compliance with legal obligations (for example,
                      accounting or tax requirements).
                    </li>
                    <li>
                      Our legitimate interests (such as site security, fraud
                      prevention, and service improvement), balanced against
                      your rights.
                    </li>
                  </ul>
                </section>

                {/* 6. How We Share Your Information */}
                <section className="mb-8">
                  <h2 className="text-xl font-semibold text-slate-800 pb-2 mb-4 border-b-2 border-blue-500">
                    6. How We Share Your Information
                  </h2>
                  <p className="text-slate-700 leading-relaxed mb-3">
                    We do not sell your personal information, but we may share
                    it with trusted third parties in limited circumstances.
                  </p>
                  <ul className="list-disc pl-6 text-slate-700 leading-relaxed space-y-2">
                    <li>
                      <strong>Service providers:</strong> Payment processors,
                      hosting providers, analytics services, and customer
                      support tools that help us operate the website.
                    </li>
                    <li>
                      <strong>Advertising and analytics partners:</strong> To
                      measure performance and, where permitted, deliver relevant
                      ads.
                    </li>
                    <li>
                      <strong>Legal and compliance:</strong> Where required by
                      law, regulation, or valid legal process, or to protect our
                      rights, users, or the public.
                    </li>
                    <li>
                      <strong>Business transfers:</strong> In the event of a
                      merger, acquisition, or sale of assets, your information
                      may be transferred as part of the transaction.
                    </li>
                  </ul>
                </section>

                {/* 7. International Transfers */}
                <section className="mb-8">
                  <h2 className="text-xl font-semibold text-slate-800 pb-2 mb-4 border-b-2 border-blue-500">
                    7. International Data Transfers
                  </h2>
                  <p className="text-slate-700 leading-relaxed mb-3">
                    Depending on where you are located and where our service
                    providers operate, your information may be transferred to
                    and processed in countries that may have different data
                    protection laws than your home jurisdiction.
                  </p>
                  <p className="text-slate-700 leading-relaxed">
                    Where required, we implement appropriate safeguards, such as
                    contractual protections, to help ensure your personal data
                    remains protected.
                  </p>
                </section>

                {/* 8. Data Retention */}
                <section className="mb-8">
                  <h2 className="text-xl font-semibold text-slate-800 pb-2 mb-4 border-b-2 border-blue-500">
                    8. Data Retention
                  </h2>
                  <p className="text-slate-700 leading-relaxed mb-3">
                    We retain your personal information only for as long as
                    necessary to fulfill the purposes described in this Privacy
                    Policy, unless a longer retention period is required or
                    permitted by law.
                  </p>
                  <p className="text-slate-700 leading-relaxed">
                    Criteria used include the duration of your account, legal
                    obligations, and the need to resolve disputes or enforce our
                    agreements.
                  </p>
                </section>

                {/* 9. Your Rights and Choices */}
                <section className="mb-8">
                  <h2 className="text-xl font-semibold text-slate-800 pb-2 mb-4 border-b-2 border-blue-500">
                    9. Your Rights and Choices
                  </h2>
                  <p className="text-slate-700 leading-relaxed mb-3">
                    Depending on your location and applicable law, you may have
                    certain rights regarding your personal information.
                  </p>
                  <ul className="list-disc pl-6 text-slate-700 leading-relaxed space-y-2">
                    <li>Access to the personal data we hold about you.</li>
                    <li>Correction of inaccurate or incomplete data.</li>
                    <li>Deletion of your personal data, subject to legal limits.</li>
                    <li>
                      Restriction or objection to certain processing activities.
                    </li>
                    <li>
                      Data portability, where applicable, to receive data in a
                      structured, commonly used format.
                    </li>
                    <li>
                      Withdrawal of consent where processing is based on your
                      consent (for example, for certain cookies or marketing).
                    </li>
                  </ul>
                  <p className="text-slate-700 leading-relaxed mt-3">
                    To exercise these rights, please contact us using the
                    details in the "Contact Us" section below. We may need to
                    verify your identity before responding to your request.
                  </p>
                </section>

                {/* 10. Security */}
                <section className="mb-8">
                  <h2 className="text-xl font-semibold text-slate-800 pb-2 mb-4 border-b-2 border-blue-500">
                    10. Data Security
                  </h2>
                  <p className="text-slate-700 leading-relaxed mb-3">
                    We use appropriate technical and organizational measures to
                    protect your personal information from unauthorized access,
                    loss, misuse, or alteration.
                  </p>
                  <p className="text-slate-700 leading-relaxed">
                    However, no method of transmission over the internet or
                    electronic storage is completely secure, and we cannot
                    guarantee absolute security.
                  </p>
                </section>

                {/* 11. Children's Privacy */}
                <section className="mb-8">
                  <h2 className="text-xl font-semibold text-slate-800 pb-2 mb-4 border-b-2 border-blue-500">
                    11. Children's Privacy
                  </h2>
                  <p className="text-slate-700 leading-relaxed mb-3">
                    BuyAPixel is not directed to children under the age of 13
                    (or a higher age as required by applicable law), and we do
                    not knowingly collect personal information from children.
                  </p>
                  <p className="text-slate-700 leading-relaxed">
                    If you believe a child has provided us with personal
                    information, please contact us so we can take appropriate
                    steps to delete such data.
                  </p>
                </section>

                {/* 12. Changes to This Policy */}
                <section className="mb-8">
                  <h2 className="text-xl font-semibold text-slate-800 pb-2 mb-4 border-b-2 border-blue-500">
                    12. Changes to This Privacy Policy
                  </h2>
                  <p className="text-slate-700 leading-relaxed mb-3">
                    We may update this Privacy Policy from time to time to
                    reflect changes in our practices, legal requirements, or
                    other operational reasons.
                  </p>
                  <p className="text-slate-700 leading-relaxed">
                    When we make changes, we will revise the "Last Updated" date
                    at the top of this page. Your continued use of BuyAPixel
                    after any changes takes effect means you accept the updated
                    policy.
                  </p>
                </section>

                {/* 13. Contact Us */}
                <section className="mb-6">
                  <h2 className="text-xl font-semibold text-slate-800 pb-2 mb-4 border-b-2 border-blue-500">
                    13. Contact Us
                  </h2>
                  <p className="text-slate-700 leading-relaxed mb-3">
                    If you have questions about this Privacy Policy or our data
                    practices, please contact us:
                  </p>
                  <div className="p-4 bg-gray-100 rounded">
                    <p className="mb-2 text-slate-800">
                      <strong>BuyAPixel</strong>
                    </p>
                    <p className="mb-2 text-slate-800">
                      Email: privacy@buyapixel.com
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
                    understood, and agree to this Privacy Policy.
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

export default PrivacyPolicy;
