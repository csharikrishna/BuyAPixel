import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";

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
            BuyAPixel - Terms of Service
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

                {/* Introduction */}
                <section className="mb-5">
                  <h2
                    className="h4 mb-3"
                    style={{
                      color: "#2c3e50",
                      borderBottom: "2px solid #3498db",
                      paddingBottom: "10px",
                    }}
                  >
                    1. Agreement to Terms
                  </h2>
                  <p style={{ color: "#34495e", lineHeight: "1.7" }}>
                    By accessing and using BuyAPixel ("the Website"), you agree
                    to be bound by these Terms of Service. BuyAPixel is a pixel
                    advertising platform where users can purchase pixel blocks
                    to display their advertisements permanently on our homepage.
                    If you do not agree to these terms, please do not use our
                    service.
                  </p>
                </section>

                {/* Service Description */}
                <section className="mb-5">
                  <h2
                    className="h4 mb-3"
                    style={{
                      color: "#2c3e50",
                      borderBottom: "2px solid #3498db",
                      paddingBottom: "10px",
                    }}
                  >
                    2. Service Description
                  </h2>
                  <p style={{ color: "#34495e", lineHeight: "1.7" }}>
                    BuyAPixel operates as a digital advertising platform
                    offering a pixel grid for purchase. Users can buy pixel
                    blocks (minimum 10×10 pixels) at the rate of $1 per pixel to
                    display their logos, images, or advertisements with
                    clickable links to their websites.
                  </p>
                  <ul style={{ color: "#34495e", lineHeight: "1.7" }}>
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
                <section className="mb-5">
                  <h2
                    className="h4 mb-3"
                    style={{
                      color: "#2c3e50",
                      borderBottom: "2px solid #3498db",
                      paddingBottom: "10px",
                    }}
                  >
                    3. User Obligations and Acceptable Use
                  </h2>
                  <p style={{ color: "#34495e", lineHeight: "1.7" }}>
                    When using BuyAPixel, you agree to:
                  </p>
                  <ul style={{ color: "#34495e", lineHeight: "1.7" }}>
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
                    <li>
                      Respect intellectual property rights of others.
                    </li>
                  </ul>
                  <div
                    className="alert mt-3"
                    style={{
                      backgroundColor: "#fff3cd",
                      borderLeft: "4px solid #ffc107",
                      color: "#856404",
                    }}
                  >
                    <strong>Prohibited Content:</strong> We do not accept
                    advertisements containing or promoting illegal activities,
                    adult content, hate speech, violence, malware, scams, or any
                    content that violates applicable laws.
                  </div>
                </section>

                {/* Payment Terms */}
                <section className="mb-5">
                  <h2
                    className="h4 mb-3"
                    style={{
                      color: "#2c3e50",
                      borderBottom: "2px solid #3498db",
                      paddingBottom: "10px",
                    }}
                  >
                    4. Payment and Pricing
                  </h2>
                  <p style={{ color: "#34495e", lineHeight: "1.7" }}>
                    Pixel blocks are sold at $1 USD per pixel with a minimum
                    purchase of 100 pixels. All payments must be made in full
                    before your advertisement is displayed. We accept major
                    credit cards and other payment methods as specified on our
                    payment page.
                  </p>
                  <p style={{ color: "#34495e", lineHeight: "1.7" }}>
                    <strong>Refund Policy:</strong> All sales are final. Due to
                    the permanent nature of pixel placement, we do not offer
                    refunds once your advertisement has been published on the
                    Website.
                  </p>
                </section>

                {/* Intellectual Property */}
                <section className="mb-5">
                  <h2
                    className="h4 mb-3"
                    style={{
                      color: "#2c3e50",
                      borderBottom: "2px solid #3498db",
                      paddingBottom: "10px",
                    }}
                  >
                    5. Intellectual Property Rights
                  </h2>
                  <p style={{ color: "#34495e", lineHeight: "1.7" }}>
                    You retain all rights to the content you submit. By
                    uploading your advertisement, you grant BuyAPixel a
                    non-exclusive, worldwide, royalty-free license to display
                    your content on our platform. You represent and warrant that
                    you own or have the necessary rights to all content you
                    submit.
                  </p>
                  <p style={{ color: "#34495e", lineHeight: "1.7" }}>
                    The BuyAPixel website design, layout, and branding are
                    protected by copyright and trademark laws. Unauthorized use
                    is prohibited.
                  </p>
                </section>

                {/* Content Moderation */}
                <section className="mb-5">
                  <h2
                    className="h4 mb-3"
                    style={{
                      color: "#2c3e50",
                      borderBottom: "2px solid #3498db",
                      paddingBottom: "10px",
                    }}
                  >
                    6. Content Review and Removal
                  </h2>
                  <p style={{ color: "#34495e", lineHeight: "1.7" }}>
                    BuyAPixel reserves the right to review all submitted content
                    before publication. We may reject or remove any
                    advertisement that violates these Terms of Service, contains
                    prohibited content, or is deemed inappropriate at our sole
                    discretion. In cases of content removal for policy
                    violations, no refund will be issued.
                  </p>
                </section>

                {/* Limitation of Liability */}
                <section className="mb-5">
                  <h2
                    className="h4 mb-3"
                    style={{
                      color: "#2c3e50",
                      borderBottom: "2px solid #3498db",
                      paddingBottom: "10px",
                    }}
                  >
                    7. Limitation of Liability
                  </h2>
                  <p style={{ color: "#34495e", lineHeight: "1.7" }}>
                    BuyAPixel is provided "as is" without warranties of any
                    kind. We are not liable for any damages arising from your
                    use of the Website, including but not limited to direct,
                    indirect, incidental, or consequential damages. This
                    includes loss of profits, data, or business opportunities.
                  </p>
                  <p style={{ color: "#34495e", lineHeight: "1.7" }}>
                    While we strive to maintain continuous service, we do not
                    guarantee uninterrupted access to the Website. We are not
                    responsible for the content or practices of third-party
                    websites linked through user advertisements.
                  </p>
                </section>

                {/* Privacy and Data */}
                <section className="mb-5">
                  <h2
                    className="h4 mb-3"
                    style={{
                      color: "#2c3e50",
                      borderBottom: "2px solid #3498db",
                      paddingBottom: "10px",
                    }}
                  >
                    8. Privacy and Data Collection
                  </h2>
                  <p style={{ color: "#34495e", lineHeight: "1.7" }}>
                    Your use of BuyAPixel is also governed by our Privacy
                    Policy. We collect and process personal information
                    necessary to provide our services, including payment
                    information and contact details. By using our service, you
                    consent to our data practices as described in our Privacy
                    Policy.
                  </p>
                </section>

                {/* Termination */}
                <section className="mb-5">
                  <h2
                    className="h4 mb-3"
                    style={{
                      color: "#2c3e50",
                      borderBottom: "2px solid #3498db",
                      paddingBottom: "10px",
                    }}
                  >
                    9. Termination and Account Suspension
                  </h2>
                  <p style={{ color: "#34495e", lineHeight: "1.7" }}>
                    BuyAPixel reserves the right to suspend or terminate access
                    to our services for any user who violates these Terms of
                    Service. We may also terminate or modify our services at any
                    time with reasonable notice. Upon termination, your right to
                    use the Website ceases immediately.
                  </p>
                </section>

                {/* Dispute Resolution */}
                <section className="mb-5">
                  <h2
                    className="h4 mb-3"
                    style={{
                      color: "#2c3e50",
                      borderBottom: "2px solid #3498db",
                      paddingBottom: "10px",
                    }}
                  >
                    10. Dispute Resolution and Governing Law
                  </h2>
                  <p style={{ color: "#34495e", lineHeight: "1.7" }}>
                    Any disputes arising from these Terms of Service or your use
                    of BuyAPixel shall be resolved through binding arbitration
                    in accordance with the rules of the American Arbitration
                    Association. These terms are governed by the laws of [Your
                    Jurisdiction], without regard to conflict of law principles.
                  </p>
                  <p style={{ color: "#34495e", lineHeight: "1.7" }}>
                    You agree that any legal action must be commenced within one
                    year after the claim arose.
                  </p>
                </section>

                {/* Changes to Terms */}
                <section className="mb-5">
                  <h2
                    className="h4 mb-3"
                    style={{
                      color: "#2c3e50",
                      borderBottom: "2px solid #3498db",
                      paddingBottom: "10px",
                    }}
                  >
                    11. Changes to Terms of Service
                  </h2>
                  <p style={{ color: "#34495e", lineHeight: "1.7" }}>
                    We reserve the right to modify these Terms of Service at any
                    time. Changes will be effective immediately upon posting to
                    the Website. Your continued use of BuyAPixel after changes
                    constitutes acceptance of the modified terms. We encourage
                    you to review these terms periodically.
                  </p>
                </section>

                {/* Contact Information */}
                <section className="mb-4">
                  <h2
                    className="h4 mb-3"
                    style={{
                      color: "#2c3e50",
                      borderBottom: "2px solid #3498db",
                      paddingBottom: "10px",
                    }}
                  >
                    12. Contact Information
                  </h2>
                  <p style={{ color: "#34495e", lineHeight: "1.7" }}>
                    If you have questions about these Terms of Service, please
                    contact us at:
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
                      Email: legal@buyapixel.com
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

export default TermsOfService;
