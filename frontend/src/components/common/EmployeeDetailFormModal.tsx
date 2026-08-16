import React from 'react';
import { SecureImage } from './SecureFile';
import { X, Printer, User as UserIcon } from 'lucide-react';
import { Employee, Company } from '../../types';
import { db } from '../../services/db';

interface EmployeeDetailFormModalProps {
  employee: Employee | null;
  isOpen: boolean;
  onClose: () => void;
}

export const EmployeeDetailFormModal: React.FC<EmployeeDetailFormModalProps> = ({
  employee,
  isOpen,
  onClose,
}) => {
  if (!isOpen || !employee) return null;

  const company: Company | undefined = db.getCompanies().find(c => c.id === employee.companyId);
  const companyName = company?.name || 'Unknown Company';

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="employee-print-overlay fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-300 w-full max-w-4xl max-h-[92vh] flex flex-col my-auto overflow-hidden animate-in zoom-in-95">
        
        {/* Modal Controls Bar */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between shrink-0 no-print">
          <div className="flex items-center gap-2">
            <UserIcon className="w-5 h-5 text-purple-400" />
            <h3 className="font-bold text-sm text-white">Employee Information Form (Official Record)</h3>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold px-3.5 py-1.5 rounded-xl text-xs transition-colors shadow-xs"
            >
              <Printer className="w-4 h-4" />
              <span>Print Form</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Form Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-50 printable-form-container">
          <div className="bg-white border-2 border-black p-5 sm:p-8 text-black font-serif max-w-[850px] mx-auto shadow-sm">
            
            {/* Header Block */}
            <div className="flex items-center justify-between border-b-2 border-black pb-3 mb-4 gap-4">
              <div className="flex items-center gap-3 sm:gap-4">
                {/* Circle Logo */}
                <div className="w-20 h-20 sm:w-22 sm:h-22 rounded-full border-4 border-[#1c3f94] flex items-center justify-center bg-white text-[10px] sm:text-[11px] text-center text-[#1c3f94] font-bold leading-tight shrink-0">
                  {company?.code || 'STF'}
                </div>

                {/* Company Title */}
                <div>
                  <div className="text-xl sm:text-2xl font-black text-[#d0202a] leading-tight">
                    {companyName}
                  </div>
                  <div className="text-sm sm:text-base font-bold text-[#1c3f94]">
                    Employee Information Record
                  </div>
                </div>
              </div>

              {/* Photo Box */}
              <div className="w-24 h-28 border border-black flex items-center justify-center text-xs text-slate-400 text-center shrink-0 overflow-hidden bg-slate-50">
                {employee.profilePhoto ? (
                  <SecureImage
                    source={employee.profilePhoto}
                    alt={employee.fullName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span>Employee<br />Photo</span>
                )}
              </div>
            </div>

            {/* Company Name Line */}
            <div className="text-base sm:text-lg font-bold mb-4 border-b border-black pb-2 flex items-center gap-2">
              <span>Company Name:-</span>
              <span className="font-sans text-slate-900 font-semibold underline underline-offset-4">
                {companyName}
              </span>
            </div>

            {/* Section 1: Personal Information */}
            <div className="mb-4">
              <div className="text-center font-bold text-[#d0202a] text-sm sm:text-base bg-[#f5f5f5] py-1 border border-black border-b-0 font-sans">
                Personal Information
              </div>
              <table className="w-full border-collapse border border-black text-xs sm:text-sm font-sans">
                <tbody>
                  <tr>
                    <td className="border border-black p-2 w-1/2">
                      <span className="font-bold font-serif">Full Name :- </span>
                      <span className="font-medium text-slate-900">{employee.fullName}</span>
                    </td>
                    <td className="border border-black p-2 w-1/2">
                      <span className="font-bold font-serif">Mobile Number :- </span>
                      <span className="font-medium text-slate-900">{employee.mobile}</span>
                    </td>
                  </tr>
                  <tr>
                    <td className="border border-black p-2">
                      <span className="font-bold font-serif">QID ID :- </span>
                      <span className="font-medium text-slate-900">{employee.qidNumber || employee.employeeCode}</span>
                    </td>
                    <td className="border border-black p-2">
                      <span className="font-bold font-serif">Alternative Contact Number :- </span>
                      <span className="font-medium text-slate-900">{employee.altMobile || 'N/A'}</span>
                    </td>
                  </tr>
                  <tr>
                    <td className="border border-black p-2">
                      <span className="font-bold font-serif">Designation :- </span>
                      <span className="font-medium text-slate-900">{employee.designationName || 'N/A'}</span>
                    </td>
                    <td className="border border-black p-2">
                      <span className="font-bold font-serif">Email Address :- </span>
                      <span className="font-medium text-slate-900">{employee.email}</span>
                    </td>
                  </tr>
                  <tr>
                    <td className="border border-black p-2">
                      <span className="font-bold font-serif">Department :- </span>
                      <span className="font-medium text-slate-900">{employee.departmentName || 'N/A'}</span>
                    </td>
                    <td className="border border-black p-2">
                      <span className="font-bold font-serif">Qatar Address :- </span>
                      <span className="font-medium text-slate-900">{employee.qatarAddress}</span>
                    </td>
                  </tr>
                  <tr>
                    <td className="border border-black p-2">
                      <span className="font-bold font-serif">Nationality :- </span>
                      <span className="font-medium text-slate-900">{employee.nationality}</span>
                    </td>
                    <td className="border border-black p-2">
                      <span className="font-bold font-serif">Home Country Address :- </span>
                      <span className="font-medium text-slate-900">{employee.homeCountryAddress || 'N/A'}</span>
                    </td>
                  </tr>
                  <tr>
                    <td className="border border-black p-2">
                      <span className="font-bold font-serif">Date of Birth :- </span>
                      <span className="font-medium text-slate-900">{employee.dateOfBirth}</span>
                    </td>
                    <td className="border border-black p-2"></td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Section 2: Identification Details */}
            <div className="mb-4">
              <div className="text-center font-bold text-[#d0202a] text-sm sm:text-base bg-[#f5f5f5] py-1 border border-black border-b-0 font-sans">
                Identification Details
              </div>
              <table className="w-full border-collapse border border-black text-xs sm:text-sm font-sans">
                <tbody>
                  <tr>
                    <td className="border border-black p-2 w-1/2">
                      <span className="font-bold font-serif">QID Number :- </span>
                      <span className="font-medium text-slate-900">{employee.qidNumber || 'N/A'}</span>
                    </td>
                    <td className="border border-black p-2 w-1/2">
                      <span className="font-bold font-serif">Passport Expiry Date :- </span>
                      <span className="font-medium text-slate-900">{employee.passportExpiryDate || 'N/A'}</span>
                    </td>
                  </tr>
                  <tr>
                    <td className="border border-black p-2">
                      <span className="font-bold font-serif">QID Expiry Date :- </span>
                      <span className="font-medium text-slate-900">{employee.qidExpiryDate || 'N/A'}</span>
                    </td>
                    <td className="border border-black p-2">
                      <span className="font-bold font-serif">Driving License No. (If Any) :- </span>
                      <span className="font-medium text-slate-900">{employee.licenseNumber || 'N/A'}</span>
                    </td>
                  </tr>
                  <tr>
                    <td className="border border-black p-2">
                      <span className="font-bold font-serif">Passport Number :- </span>
                      <span className="font-medium text-slate-900">{employee.passportNumber || 'N/A'}</span>
                    </td>
                    <td className="border border-black p-2">
                      <span className="font-bold font-serif">Driving License Expiry :- </span>
                      <span className="font-medium text-slate-900">{employee.licenseExpiryDate || 'N/A'}</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Section 3: Emergency Contact Information */}
            <div className="mb-4">
              <div className="text-center font-bold text-[#d0202a] text-sm sm:text-base bg-[#f5f5f5] py-1 border border-black border-b-0 font-sans">
                Emergency Contact Information
              </div>
              <table className="w-full border-collapse border border-black text-xs sm:text-sm font-sans">
                <tbody>
                  <tr>
                    <td className="border border-black p-2 w-1/2">
                      <span className="font-bold font-serif">Contact Person Name :- </span>
                      <span className="font-medium text-slate-900">{employee.emergencyContact?.name || 'N/A'}</span>
                    </td>
                    <td className="border border-black p-2 w-1/2">
                      <span className="font-bold font-serif">Mobile Number :- </span>
                      <span className="font-medium text-slate-900">{employee.emergencyContact?.phone || 'N/A'}</span>
                    </td>
                  </tr>
                  <tr>
                    <td className="border border-black p-2">
                      <span className="font-bold font-serif">Relationship :- </span>
                      <span className="font-medium text-slate-900">{employee.emergencyContact?.relationship || 'N/A'}</span>
                    </td>
                    <td className="border border-black p-2">
                      <span className="font-bold font-serif">Address :- </span>
                      <span className="font-medium text-slate-900">{employee.qatarAddress}</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Section 4: Employment Information */}
            <div className="mb-4">
              <div className="text-center font-bold text-[#d0202a] text-sm sm:text-base bg-[#f5f5f5] py-1 border border-black border-b-0 font-sans">
                Employment Information
              </div>
              <table className="w-full border-collapse border border-black text-xs sm:text-sm font-sans">
                <tbody>
                  <tr>
                    <td className="border border-black p-2 w-1/2">
                      <span className="font-bold font-serif">Joining Date :- </span>
                      <span className="font-medium text-slate-900">{employee.joiningDate}</span>
                    </td>
                    <td className="border border-black p-2 w-1/2">
                      <span className="font-bold font-serif">NOC Status :- </span>
                      <span className="font-medium text-slate-900">{employee.nocStatus || 'N/A'}</span>
                    </td>
                  </tr>
                  <tr>
                    <td className="border border-black p-2">
                      <span className="font-bold font-serif">Trade / Specialization :- </span>
                      <span className="font-medium text-slate-900">{employee.tradeSpecialization || 'N/A'}</span>
                    </td>
                    <td className="border border-black p-2">
                      <span className="font-bold font-serif">Salary Payment Mode :- </span>
                      <span className="font-medium text-slate-900">{employee.salaryPaymentMode || 'N/A'}</span>
                    </td>
                  </tr>
                  <tr>
                    <td className="border border-black p-2">
                      <span className="font-bold font-serif">Previous Company Name :- </span>
                      <span className="font-medium text-slate-900">{employee.previousCompanyName || 'N/A'}</span>
                    </td>
                    <td className="border border-black p-2">
                      <span className="font-bold font-serif">Bank / Wallet Details :- </span>
                      <span className="font-medium text-slate-900">{employee.bankWalletDetails || 'N/A'}</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Section 5: Terms & Conditions */}
            <div className="mt-4">
              <div className="font-bold text-[#7a2e8e] text-sm sm:text-base mb-1 font-serif">
                Terms &amp; Conditions :-
              </div>
              <ol className="list-decimal text-xs sm:text-sm text-[#0a6e3d] leading-relaxed pl-5 font-sans space-y-1">
                <li>All information provided in this form is true and correct.</li>
                <li>The concerned person shall immediately inform the company of any changes to personal information, contact number, passport, QID, or address.</li>
                <li>The concerned person must comply with company policies, safety regulations, and Qatar Labor Law.</li>
                <li>Any false or misleading information provided may result in disciplinary action by the company.</li>
                <li>The concerned person agrees to cooperate with the company regarding document renewals and official requirements.</li>
              </ol>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
};