import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";

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
    <div className="min-vh-100" style={{ backgroundColor: "#f8f9fa" }}>
      {/* Fixed Back Button */}
      <button
        type="button"
        onClick={handleBack}
        className="btn btn-outline-secondary position-fixed"
        style={{ top: "1rem", left: "1rem", zIndex: 1050 }}
      >
        ← Back
      </button>

      {/* Header */}
      <header className="py-4" style={{ backgroundColor: "#2c3e50" }}>
        <div className="container">
          <h1 className="text-center mb-0" style={{ color: "#ffffff" }}>
            BuyAPixel – Privacy Policy
          </h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="container py-5">
        <div className="row justify-content-center">
          <div className="col-lg-10">
            <div
              className="card shadow-sm"
              style={{ backgroundColor: "#ffffff", border: "none" }}
            >
              <div className="card-body p-4 p-md-5">
                {/* Last Updated */}
                <div
                  className="alert mb-4"
                  style={{
                    backgroundColor: "#e8f4f8",
                    borderLeft: "4px solid #3498db",
                    color: "#2c3e50",
                  }}
                >
                  <strong>Last Updated:</strong> December 10, 2025
                </div>

                {/* 1. Introduction */}
                <section className="mb-5">
                  <h2
                    className="h4 mb-3"
                    style={{
                      color: "#2c3e50",
                      borderBottom: "2px solid #3498db",
                      paddingBottom: "10px",
                    }}
                  >
                    1. Introduction
                  </h2>
                  <p style={{ color: "#34495e", lineHeight: "1.7" }}>
                    This Privacy Policy explains how BuyAPixel ("we", "us", or
                    "our") collects, uses, discloses, and protects your personal
                    information when you access or use our website and services.
                    By using BuyAPixel, you agree to the collection and use of
                    information in accordance with this Privacy Policy.
                  </p>
                </section>

                {/* 2. Information We Collect */}
                <section className="mb-5">
                  <h2
                    className="h4 mb-3"
                    style={{
                      color: "#2c3e50",
                      borderBottom: "2px solid #3498db",
                      paddingBottom: "10px",
                    }}
                  >
                    2. Information We Collect
                  </h2>
                  <p style={{ color: "#34495e", lineHeight: "1.7" }}>
                    We collect information that you provide directly to us, as
                    well as data collected automatically when you use our
                    website.[web:49][web:52]
                  </p>
                  <ul style={{ color: "#34495e", lineHeight: "1.7" }}>
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
                <section className="mb-5">
                  <h2
                    className="h4 mb-3"
                    style={{
                      color: "#2c3e50",
                      borderBottom: "2px solid #3498db",
                      paddingBottom: "10px",
                    }}
                  >
                    3. How We Use Your Information
                  </h2>
                  <p style={{ color: "#34495e", lineHeight: "1.7" }}>
                    We use the information we collect for specific, clearly
                    defined purposes.[web:49][web:52]
                  </p>
                  <ul style={{ color: "#34495e", lineHeight: "1.7" }}>
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
                <section className="mb-5">
                  <h2
                    className="h4 mb-3"
                    style={{
                      color: "#2c3e50",
                      borderBottom: "2px solid #3498db",
                      paddingBottom: "10px",
                    }}
                  >
                    4. Cookies and Tracking Technologies
                  </h2>
                  <p style={{ color: "#34495e", lineHeight: "1.7" }}>
                    We use cookies and similar technologies to recognize your
                    browser, remember your preferences, and analyze how you
                    interact with our website.[web:49][web:51][web:54]
                  </p>
                  <ul style={{ color: "#34495e", lineHeight: "1.7" }}>
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
                  <p style={{ color: "#34495e", lineHeight: "1.7" }}>
                    Where required, we will obtain your consent before setting
                    non‑essential cookies and provide options to manage or
                    withdraw consent at any time.[web:51][web:52]
                  </p>
                </section>

                {/* 5. Legal Bases (if applicable) */}
                <section className="mb-5">
                  <h2
                    className="h4 mb-3"
                    style={{
                      color: "#2c3e50",
                      borderBottom: "2px solid #3498db",
                      paddingBottom: "10px",
                    }}
                  >
                    5. Legal Bases for Processing
                  </h2>
                  <p style={{ color: "#34495e", lineHeight: "1.7" }}>
                    Where applicable data protection laws require it, we process
                    your personal data based on one or more of the following
                    legal bases:[web:52][web:56]
                  </p>
                  <ul style={{ color: "#34495e", lineHeight: "1.7" }}>
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
                <section className="mb-5">
                  <h2
                    className="h4 mb-3"
                    style={{
                      color: "#2c3e50",
                      borderBottom: "2px solid #3498db",
                      paddingBottom: "10px",
                    }}
                  >
                    6. How We Share Your Information
                  </h2>
                  <p style={{ color: "#34495e", lineHeight: "1.7" }}>
                    We do not sell your personal information, but we may share
                    it with trusted third parties in limited circumstances.[web:49][web:52][web:56]
                  </p>
                  <ul style={{ color: "#34495e", lineHeight: "1.7" }}>
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
                <section className="mb-5">
                  <h2
                    className="h4 mb-3"
                    style={{
                      color: "#2c3e50",
                      borderBottom: "2px solid #3498db",
                      paddingBottom: "10px",
                    }}
                  >
                    7. International Data Transfers
                  </h2>
                  <p style={{ color: "#34495e", lineHeight: "1.7" }}>
                    Depending on where you are located and where our service
                    providers operate, your information may be transferred to
                    and processed in countries that may have different data
                    protection laws than your home jurisdiction.[web:52][web:53]
                  </p>
                  <p style={{ color: "#34495e", lineHeight: "1.7" }}>
                    Where required, we implement appropriate safeguards, such as
                    contractual protections, to help ensure your personal data
                    remains protected.
                  </p>
                </section>

                {/* 8. Data Retention */}
                <section className="mb-5">
                  <h2
                    className="h4 mb-3"
                    style={{
                      color: "#2c3e50",
                      borderBottom: "2px solid #3498db",
                      paddingBottom: "10px",
                    }}
                  >
                    8. Data Retention
                  </h2>
                  <p style={{ color: "#34495e", lineHeight: "1.7" }}>
                    We retain your personal information only for as long as
                    necessary to fulfill the purposes described in this Privacy
                    Policy, unless a longer retention period is required or
                    permitted by law.[web:49][web:52]
                  </p>
                  <p style={{ color: "#34495e", lineHeight: "1.7" }}>
                    Criteria used include the duration of your account, legal
                    obligations, and the need to resolve disputes or enforce our
                    agreements.
                  </p>
                </section>

                {/* 9. Your Rights and Choices */}
                <section className="mb-5">
                  <h2
                    className="h4 mb-3"
                    style={{
                      color: "#2c3e50",
                      borderBottom: "2px solid #3498db",
                      paddingBottom: "10px",
                    }}
                  >
                    9. Your Rights and Choices
                  </h2>
                  <p style={{ color: "#34495e", lineHeight: "1.7" }}>
                    Depending on your location and applicable law, you may have
                    certain rights regarding your personal information.[web:52][web:56]
                  </p>
                  <ul style={{ color: "#34495e", lineHeight: "1.7" }}>
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
                  <p style={{ color: "#34495e", lineHeight: "1.7" }}>
                    To exercise these rights, please contact us using the
                    details in the "Contact Us" section below. We may need to
                    verify your identity before responding to your request.
                  </p>
                </section>

                {/* 10. Security */}
                <section className="mb-5">
                  <h2
                    className="h4 mb-3"
                    style={{
                      color: "#2c3e50",
                      borderBottom: "2px solid #3498db",
                      paddingBottom: "10px",
                    }}
                  >
                    10. Data Security
                  </h2>
                  <p style={{ color: "#34495e", lineHeight: "1.7" }}>
                    We use appropriate technical and organizational measures to
                    protect your personal information from unauthorized access,
                    loss, misuse, or alteration.[web:49][web:57]
                  </p>
                  <p style={{ color: "#34495e", lineHeight: "1.7" }}>
                    However, no method of transmission over the internet or
                    electronic storage is completely secure, and we cannot
                    guarantee absolute security.
                  </p>
                </section>

                {/* 11. Children's Privacy */}
                <section className="mb-5">
                  <h2
                    className="h4 mb-3"
                    style={{
                      color: "#2c3e50",
                      borderBottom: "2px solid #3498db",
                      paddingBottom: "10px",
                    }}
                  >
                    11. Children's Privacy
                  </h2>
                  <p style={{ color: "#34495e", lineHeight: "1.7" }}>
                    BuyAPixel is not directed to children under the age of 13
                    (or a higher age as required by applicable law), and we do
                    not knowingly collect personal information from children.[web:49][web:53]
                  </p>
                  <p style={{ color: "#34495e", lineHeight: "1.7" }}>
                    If you believe a child has provided us with personal
                    information, please contact us so we can take appropriate
                    steps to delete such data.
                  </p>
                </section>

                {/* 12. Changes to This Policy */}
                <section className="mb-5">
                  <h2
                    className="h4 mb-3"
                    style={{
                      color: "#2c3e50",
                      borderBottom: "2px solid #3498db",
                      paddingBottom: "10px",
                    }}
                  >
                    12. Changes to This Privacy Policy
                  </h2>
                  <p style={{ color: "#34495e", lineHeight: "1.7" }}>
                    We may update this Privacy Policy from time to time to
                    reflect changes in our practices, legal requirements, or
                    other operational reasons.[web:49][web:52]
                  </p>
                  <p style={{ color: "#34495e", lineHeight: "1.7" }}>
                    When we make changes, we will revise the "Last Updated" date
                    at the top of this page. Your continued use of BuyAPixel
                    after any changes takes effect means you accept the updated
                    policy.
                  </p>
                </section>

                {/* 13. Contact Us */}
                <section className="mb-4">
                  <h2
                    className="h4 mb-3"
                    style={{
                      color: "#2c3e50",
                      borderBottom: "2px solid #3498db",
                      paddingBottom: "10px",
                    }}
                  >
                    13. Contact Us
                  </h2>
                  <p style={{ color: "#34495e", lineHeight: "1.7" }}>
                    If you have questions about this Privacy Policy or our data
                    practices, please contact us:
                  </p>
                  <div
                    className="p-3 mt-3"
                    style={{
                      backgroundColor: "#ecf0f1",
                      borderRadius: "5px",
                    }}
                  >
                    <p className="mb-2" style={{ color: "#2c3e50" }}>
                      <strong>BuyAPixel</strong>
                    </p>
                    <p className="mb-2" style={{ color: "#2c3e50" }}>
                      Email: privacy@buyapixel.com
                    </p>
                    <p className="mb-0" style={{ color: "#2c3e50" }}>
                      Support: support@buyapixel.com
                    </p>
                  </div>
                </section>

                {/* Acceptance */}
                <div
                  className="alert mt-4"
                  style={{
                    backgroundColor: "#d4edda",
                    borderLeft: "4px solid #28a745",
                    color: "#155724",
                  }}
                >
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
      <footer className="py-4 mt-5" style={{ backgroundColor: "#34495e" }}>
        <div className="container">
          <p className="text-center mb-0" style={{ color: "#ecf0f1" }}>
            © 2025 BuyAPixel. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default PrivacyPolicy;
