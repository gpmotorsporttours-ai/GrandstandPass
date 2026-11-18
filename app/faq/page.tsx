
import Link from 'next/link';
import { HelpCircle, Mail } from 'lucide-react';

const faqSections = [
  {
    title: 'General',
    questions: [
      {
        question: 'What is Grandstand Pass?',
        answer:
          'Grandstand Pass is an independent ticket reseller offering tickets to major sporting events around the world, including Formula 1, MotoGP, Football, Tennis and other sports.',
      },
      {
        question: 'How can I purchase tickets?',
        answer:
          'Browse our sporting events, select your preferred ticket category and quantity, and follow the checkout instructions. Online payments and live purchases will become available once our payment integration and final testing are complete.',
      },
      {
        question: 'Is ticket availability guaranteed?',
        answer:
          'Ticket availability and prices can change. All ticket requests are subject to final availability verification and successful booking confirmation.',
      },
      {
        question: 'Why might ticket prices differ from face value?',
        answer:
          'Grandstand Pass operates as an independent ticket reseller. Ticket prices may differ from the original face value depending on demand, availability and market conditions.',
      },
      {
        question: 'Are there additional ticket-handling fees?',
        answer:
          'No. Our ticket-handling fee is already included in the displayed ticket price. Any other applicable charges will be clearly disclosed before payment.',
      },
    ],
  },
  {
    title: 'Ticket Delivery',
    questions: [
      {
        question: 'When will I receive my tickets?',
        answer:
          'Ticket delivery times vary by event and ticket type. Many tickets become available approximately 3 to 7 days before the event, although some may be delivered earlier or closer to the event date. We will provide further instructions when your tickets become available.',
      },
      {
        question: 'How will my tickets be delivered?',
        answer:
          'Depending on the event, tickets may be delivered electronically, through a mobile ticketing application, by physical delivery or through collection at a designated location. The applicable delivery arrangements will be communicated to you.',
      },
      {
        question: 'Will I receive my tickets immediately after payment?',
        answer:
          'Not necessarily. Your booking confirmation and the delivery of your actual event tickets are separate steps. Some tickets are only released shortly before the event.',
      },
    ],
  },
  {
    title: 'Payments & Refunds',
    questions: [
      {
        question: 'How can I pay for my tickets?',
        answer:
          'We are preparing secure online payment facilities. Available payment methods and currencies will be displayed during checkout once live purchases are enabled.',
      },
      {
        question: 'Can I cancel my booking?',
        answer:
          'Confirmed event ticket purchases are generally final and non-refundable, except where applicable law or the relevant event terms provide otherwise. Please review your event and ticket details carefully before purchasing.',
      },
      {
        question: 'What happens if an event is postponed?',
        answer:
          'Tickets generally remain valid for the rescheduled event, subject to the event organiser’s rules. We will communicate relevant information as it becomes available.',
      },
      {
        question: 'What happens if an event is cancelled?',
        answer:
          'If an event is cancelled, refund eligibility and available remedies will depend on the applicable event terms and consumer protection laws. Please contact our team for assistance.',
      },
    ],
  },
  {
    title: 'Seating & Bookings',
    questions: [
      {
        question: 'Can I choose my exact seat?',
        answer:
          'Ticket categories and seating arrangements vary by event. Unless a specific seat is expressly confirmed, tickets are sold according to the selected category rather than a particular seat number.',
      },
      {
        question: 'Will tickets purchased together have adjacent seats?',
        answer:
          'Seating arrangements depend on the event and ticket category. Adjacent seating is only guaranteed where this is specifically stated in the ticket information.',
      },
      {
        question: 'Can I resell my tickets through Grandstand Pass?',
        answer:
          'Grandstand Pass does not currently offer a public ticket relisting or resale service.',
      },
      {
        question: 'How can I check my booking?',
        answer:
          'Visit our My Booking page to check your order using your booking reference and private access details. You can also contact our support team for assistance.',
      },
    ],
  },
];

export default function FAQPage() {
  return (
    <main className="bg-slate-50 min-h-screen py-14 md:py-20">
      <div className="container-wide max-w-5xl">
        <div className="text-center mb-12">
          <HelpCircle
            className="mx-auto text-blue-600 mb-5"
            size={42}
          />

          <h1 className="text-4xl md:text-5xl font-bold text-[#0b2144]">
            Frequently Asked Questions
          </h1>

          <p className="mt-5 text-lg text-slate-600">
            Everything you need to know about booking
            sporting event tickets with Grandstand Pass.
          </p>
        </div>

        <div className="space-y-8">
          {faqSections.map((section) => (
            <section
              key={section.title}
              className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 shadow-sm"
            >
              <h2 className="text-2xl font-bold text-[#0b2144] mb-5">
                {section.title}
              </h2>

              <div className="divide-y divide-slate-200">
                {section.questions.map((item) => (
                  <details
                    key={item.question}
                    className="group py-5"
                  >
                    <summary className="cursor-pointer list-none flex items-center justify-between gap-4 font-semibold text-[#0b2144]">
                      <span>{item.question}</span>
                      <span className="text-blue-600 text-xl group-open:rotate-45 transition-transform">
                        +
                      </span>
                    </summary>

                    <p className="mt-4 text-slate-600 leading-7">
                      {item.answer}
                    </p>
                  </details>
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-12 text-center bg-white border border-slate-200 rounded-2xl p-8">
          <Mail
            className="mx-auto text-blue-600 mb-4"
            size={32}
          />

          <h2 className="text-2xl font-bold text-[#0b2144]">
            Still have questions?
          </h2>

          <p className="mt-3 text-slate-600">
            Our team is here to assist with your enquiries.
          </p>

          <Link
            href="/contact"
            className="inline-block mt-6 bg-[#0b2144] text-white font-semibold px-7 py-4 rounded-xl hover:opacity-90 transition-opacity"
          >
            Contact Us
          </Link>

          <p className="mt-4 text-sm text-slate-500">
            info@grandstandpass.com
          </p>
        </div>

        <p className="text-center text-sm text-slate-500 mt-8">
          Grandstand Pass is currently in development.
          Live ticket purchases are not yet available.
        </p>
      </div>
    </main>
  );
}
