'use client'
import LegalPage from '../../components/LegalPage'
import ReportForm from '../../components/ReportForm'

export default function ContactPage() {
  return <LegalPage doc="contact" after={{ report: <ReportForm /> }} />
}
