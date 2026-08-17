import React from 'react';
import { X, Printer, User as UserIcon } from 'lucide-react';
import { Employee, Company } from '../../types';
import { db } from '../../services/db';
import { CompanyLogo } from './CompanyLogo';
import { SecureImage } from './SecureFile';

interface EmployeeDetailFormModalProps {
  employee: Employee | null;
  isOpen: boolean;
  onClose: () => void;
}

type FormRow = [string, React.ReactNode, string, React.ReactNode];

const display = (value?: string | null) => value?.trim() || 'N/A';

const InformationSection: React.FC<{ title: string; rows: FormRow[] }> = ({ title, rows }) => (
  <section className="official-form-section">
    <h2 className="employee-section-title">{title}</h2>
    <table>
      <tbody>
        {rows.map(([leftLabel, leftValue, rightLabel, rightValue], index) => (
          <tr key={`${title}-${index}`}>
            <td><strong>{leftLabel} :-</strong> <span>{leftValue}</span></td>
            <td><strong>{rightLabel} :-</strong> <span>{rightValue}</span></td>
          </tr>
        ))}
      </tbody>
    </table>
  </section>
);

const TermsList: React.FC<{ start: number; terms: string[] }> = ({ start, terms }) => (
  <ol className="official-terms" start={start}>
    {terms.map(term => <li key={term}>{term}</li>)}
  </ol>
);

const allTerms = [
  'All information provided in this form is true and correct.',
  'The concerned person shall immediately inform the company of any changes to personal information, contact number, passport, QID, or address.',
  'The concerned person must comply with company policies, safety regulations, and Qatar Labor Law.',
  'Any false or misleading information provided may result in disciplinary action by the company.',
  'The concerned person agrees to cooperate with the company regarding document renewals and official requirements.',
  'The company may use the provided information for administrative and legal purposes.',
  'Company-approved outside workers must pay a monthly company fee of QAR 200.',
  'A maximum outstanding balance of 2 months is permitted. If the outstanding balance exceeds 3 months, the company may take appropriate legal action in accordance with the law.',
  'Drivers using company vehicles under bank financing must pay all installments on time.',
  'A late fee of QAR 500 shall apply to each delayed installment.',
  'Failure to pay installments and applicable penalties may result in legal action.',
  'Concerned person must comply with all Qatar Laws and company policies.',
  'Any involvement in illegal activities shall be the sole responsibility of the Concerned Person.',
  'By signing this form, the Concerned person agrees to all terms and conditions stated above.',
];

export const EmployeeDetailFormModal: React.FC<EmployeeDetailFormModalProps> = ({
  employee,
  isOpen,
  onClose,
}) => {
  if (!isOpen || !employee) return null;

  const company: Company | undefined = db.getCompanies().find(item => item.id === employee.companyId);
  const companyName = company?.name || 'Unknown Company';
  const addressParts = [company?.poBox ? `P.O. Box : ${company.poBox}` : '', company?.email ? `Email: ${company.email}` : '', company?.address || company?.city || '']
    .filter(Boolean)
    .join(', ');

  const personalRows: FormRow[] = [
    ['Full Name', display(employee.fullName), 'Mobile Number', display(employee.mobile)],
    ['QID ID', display(employee.qidNumber || employee.employeeCode), 'Alternative Contact Number', display(employee.altMobile)],
    ['Designation', display(employee.designationName), 'Email Address', display(employee.email)],
    ['Department', display(employee.departmentName), 'Qatar Address', display(employee.qatarAddress)],
    ['Nationality', display(employee.nationality), 'Home Country Address', display(employee.homeCountryAddress)],
    ['Date of Birth', display(employee.dateOfBirth), '', ''],
  ];

  const identificationRows: FormRow[] = [
    ['QID Number', display(employee.qidNumber), 'Passport Expiry Date', display(employee.passportExpiryDate)],
    ['QID Expiry Date', display(employee.qidExpiryDate), 'Driving License No. (If Any)', display(employee.licenseNumber)],
    ['Passport Number', display(employee.passportNumber), 'Driving License Expiry', display(employee.licenseExpiryDate)],
  ];

  const emergencyRows: FormRow[] = [
    ['Contact Person Name', display(employee.emergencyContact?.name), 'Mobile Number', display(employee.emergencyContact?.phone)],
    ['Relationship', display(employee.emergencyContact?.relationship), 'Address', display(employee.homeCountryAddress || employee.qatarAddress)],
  ];

  const employmentRows: FormRow[] = [
    ['Joining Date', display(employee.joiningDate), 'NOC Status', display(employee.nocStatus)],
    ['Trade / Specialization', display(employee.tradeSpecialization), 'Salary Payment Mode', display(employee.salaryPaymentMode)],
    ['Previous Company Name', display(employee.previousCompanyName), 'Bank / Wallet Details', display(employee.bankWalletDetails)],
  ];

  return (
    <div className="employee-print-overlay fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="employee-print-modal bg-white rounded-2xl shadow-2xl border border-slate-300 w-full max-w-5xl max-h-[94vh] flex flex-col my-auto overflow-hidden animate-in zoom-in-95">
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between shrink-0 no-print">
          <div className="flex items-center gap-2">
            <UserIcon className="w-5 h-5 text-purple-400" />
            <h3 className="font-bold text-sm text-white">Employee Information Form</h3>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => window.print()} className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold px-3.5 py-1.5 rounded-xl text-xs transition-colors shadow-xs">
              <Printer className="w-4 h-4" />
              <span>Print Form</span>
            </button>
            <button onClick={onClose} aria-label="Close" className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 sm:p-6 bg-slate-200 printable-form-container">
          <div className="official-form-pages">
            <article className="official-form-page official-form-page-one">
              <header className="employee-form-header official-form-header">
                <div className="official-company-logo">
                  <CompanyLogo
                    code={company?.code || 'COMPANY'}
                    name={companyName}
                    logoUrl={company?.logoUrl}
                    sizeClass="w-full h-full"
                    textClass="text-xl"
                    rounded="rounded-none"
                    className="border-0 shadow-none"
                  />
                </div>
                <div className="official-employee-photo">
                  {employee.profilePhoto ? (
                    <SecureImage source={employee.profilePhoto} alt={employee.fullName} className="w-full h-full object-cover" />
                  ) : (
                    <span>Employee Photo</span>
                  )}
                </div>
              </header>

              <div className="official-company-name">
                <strong>Company Name:-</strong>
                <span>{companyName}</span>
              </div>

              <InformationSection title="Personal Information" rows={personalRows} />
              <InformationSection title="Identification Details" rows={identificationRows} />
              <InformationSection title="Emergency Contact Information" rows={emergencyRows} />
              <InformationSection title="Employment Information" rows={employmentRows} />

              <section className="official-terms-section">
                <h2>Terms &amp; Conditions :-</h2>
                <TermsList start={1} terms={allTerms.slice(0, 5)} />
              </section>
            </article>

            <article className="official-form-page official-form-page-two">
              <TermsList start={6} terms={allTerms.slice(5)} />

              <section className="official-declaration">
                <h2>Declaration :-</h2>
                <p>I hereby confirm that the information provided above is true and accurate to the best of my knowledge.</p>
                <p>I understand and accept the above-mentioned terms and conditions.</p>
              </section>

              <div className="official-signature-area">
                <div className="signature signature-person"><span>Concerned Person`s Signature</span></div>
                <div className="signature-date">Date: ____ / ____ / ______</div>
                <div className="signature signature-admin"><span>HR/Admin Signature</span></div>
                <div className="company-stamp">Company Stamp</div>
              </div>

              <footer className="official-company-footer">
                <div>{company?.phone ? `Mobile : ${company.phone}` : ''}{company?.crNumber ? `, C.R.No.: ${company.crNumber}` : ''}</div>
                <div>{addressParts}</div>
              </footer>
            </article>
          </div>
        </div>
      </div>
    </div>
  );
};
