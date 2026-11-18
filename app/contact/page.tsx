
import Link from 'next/link';
import {
  ArrowLeft,
  Mail,
  MessageCircle,
  ShieldCheck,
} from 'lucide-react';

export const metadata = {
  title: 'Contact Us | Grandstand Pass',
  description:
    'Contact Grandstand Pass for general enquiries and assistance with sports event tickets.',
};

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <section className="bg-ice border-b">
        <div className="container-wide py-5">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-semibold text-navy hover:underline"
          >
            <ArrowLeft size={16} />
            Back to Home
          </Link>
        </div>
      </section>

      <section className="container-wide py-12 md:py-20">
        <div className="mx-auto max-w-3xl">
          <div className="text-center mb-10">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue">
              <MessageCircle size={32} />
            </div>

            <h1 className="text-3xl md:text-4xl font-black text-navy">
              Contact Us
            </h1>

            <p className="mt-4 text-lg text-slate-600">
              Have a question about Grandstand Pass
              or an upcoming sporting event?
              We're here to help.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-8 md:p-12 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="rounded-xl bg-blue-50 p-3 text-blue">
                <Mail size={26} />
              </div>

              <div>
                <h2 className="text-xl font-black text-navy">
                  Email Our Team
                </h2>

                <p className="mt-2 text-slate-600">
                  For general enquiries, event information
                  or questions about our services,
                  please contact us by email.
                </p>

                <a
                  href="mailto:info@grandstandpass.com"
                  className="mt-5 inline-block break-all text-lg font-bold text-blue hover:underline"
                >
                  info@grandstandpass.com
                </a>
              </div>
            </div>

            <div className="mt-8 border-t border-slate-200 pt-8">
              <a
                href="mailto:info@grandstandpass.com?subject=Grandstand%20Pass%20Enquiry"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-navy px-7 py-4 font-bold text-white hover:opacity-90 transition-opacity"
              >
                <Mail size={19} />
                Send Us an Email
              </a>

              <p className="mt-4 text-sm text-slate-500">
                This button opens your email application.
                No message is sent until you choose to send it.
              </p>
            </div>
          </div>

          <div className="mt-8 grid gap-5 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <ShieldCheck
                size={25}
                className="text-blue mb-4"
              />

              <h3 className="font-bold text-navy">
                Booking Enquiries
              </h3>

              <p className="mt-2 text-sm text-slate-600">
                If you're contacting us about an existing
                booking, please include your order
                reference in your email.
              </p>

              <p className="mt-3 text-xs text-slate-500">
                Never send payment card details,
                passwords or private booking-access
                tokens by email.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <MessageCircle
                size={25}
                className="text-blue mb-4"
              />

              <h3 className="font-bold text-navy">
                Your Booking
              </h3>

              <p className="mt-2 text-sm text-slate-600">
                Looking for information about
                your booking? Visit My Booking
                to check its current status.
              </p>

              <Link
                href="/my-booking"
                className="mt-4 inline-block text-sm font-bold text-blue hover:underline"
              >
                View My Booking
              </Link>
            </div>
          </div>

          <p className="mt-10 text-center text-sm text-slate-500">
            Grandstand Pass is currently in development.
            Ticket purchases and live bookings are not
            yet available through this website.
          </p>
        </div>
      </section>
    </main>
  );
}
