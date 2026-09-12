<?php

namespace App\Http\Controllers;

use App\Models\AccountingAccount;
use App\Models\AccountingPayment;
use App\Services\AuditService;
use App\Services\CompanyScope;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class AccountingController extends Controller
{
    public function __construct(private readonly CompanyScope $scope, private readonly AuditService $audit) {}

    public function accounts(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless($user->isSuperAdmin() || $user->can('accounting.view'), 403);
        $query = AccountingAccount::with(['company', 'employee', 'vehicle'])->withSum('payments', 'amount_paid')->withSum('payments', 'amount_due');
        $this->scope->apply($query, $user);
        if ($request->filled('company_id')) { $id = (int) $request->input('company_id'); $this->scope->authorize($user, $id); $query->where('company_id', $id); }
        if ($request->filled('account_type')) $query->where('account_type', $request->input('account_type'));
        if ($request->filled('status')) $query->where('status', $request->input('status'));
        if ($search = trim((string) $request->input('search'))) {
            $query->where(fn ($q) => $q->where('title', 'like', "%{$search}%")->orWhere('reference_no', 'like', "%{$search}%")
                ->orWhereHas('employee', fn ($e) => $e->where('full_name', 'like', "%{$search}%")->orWhere('employee_code', 'like', "%{$search}%"))
                ->orWhereHas('vehicle', fn ($v) => $v->where('vehicle_number', 'like', "%{$search}%")->orWhere('plate_number', 'like', "%{$search}%")));
        }
        $p = $query->latest()->paginate(min(100, max(1, $request->integer('per_page', 20))));
        $p->setCollection($p->getCollection()->map(fn (AccountingAccount $a) => $this->account($a)));
        return response()->json($p);
    }

    public function storeAccount(Request $request): JsonResponse
    {
        $user = $request->user(); abort_unless($user->isSuperAdmin() || $user->can('accounting.manage'), 403);
        $data = $this->validateAccount($request->all()); $this->scope->authorize($user, $data['companyId']);
        $account = AccountingAccount::create($this->accountData($data, $user, true));
        $this->audit->record($user, 'CREATE', 'AccountingAccount', $account->id, $account->company_id, null, $account->toArray());
        return response()->json(['data' => $this->account($account->load(['company','employee','vehicle']))], 201);
    }

    public function updateAccount(Request $request, AccountingAccount $account): JsonResponse
    {
        $user = $request->user(); abort_unless($user->isSuperAdmin() || $user->can('accounting.manage'), 403); $this->scope->authorize($user, $account->company_id);
        $data = $this->validateAccount($request->all(), true); $companyId = (int) ($data['companyId'] ?? $account->company_id); $this->scope->authorize($user, $companyId);
        $before = $account->toArray(); $account->fill($this->accountData($data, $user, false, $account)); $account->save();
        $this->audit->record($user, 'UPDATE', 'AccountingAccount', $account->id, $account->company_id, $before, $account->toArray());
        return response()->json(['data' => $this->account($account->fresh(['company','employee','vehicle']))]);
    }

    public function deleteAccount(Request $request, AccountingAccount $account): JsonResponse
    {
        $user = $request->user(); abort_unless($user->isSuperAdmin() || $user->can('accounting.manage'), 403); $this->scope->authorize($user, $account->company_id);
        $account->delete(); $this->audit->record($user, 'ARCHIVE', 'AccountingAccount', $account->id, $account->company_id);
        return response()->json(['message' => 'Accounting account archived.']);
    }

    public function payments(Request $request): JsonResponse
    {
        $user = $request->user(); abort_unless($user->isSuperAdmin() || $user->can('accounting.view'), 403);
        $query = AccountingPayment::with('account.company');
        $query->whereHas('account', function ($q) use ($request, $user) {
            if (!$user->isSuperAdmin() && !$user->all_companies) $q->whereIn('company_id', $this->scope->ids($user));
            if ($request->filled('account_id')) $q->whereKey($request->integer('account_id'));
            if ($request->filled('account_type')) $q->where('account_type', $request->input('account_type'));
            if ($request->filled('company_id')) { $this->scope->authorize($user, $request->integer('company_id')); $q->where('company_id', $request->integer('company_id')); }
        });
        if ($request->filled('status')) $query->where('status', $request->input('status'));
        $p = $query->latest('payment_date')->latest()->paginate(min(100, max(1, $request->integer('per_page', 50))));
        $p->setCollection($p->getCollection()->map(fn (AccountingPayment $payment) => $this->payment($payment)));
        return response()->json($p);
    }

    public function storePayment(Request $request): JsonResponse
    {
        $user = $request->user(); abort_unless($user->isSuperAdmin() || $user->can('accounting.payments.manage'), 403);
        $data = $this->validatePayment($request->all()); $account = AccountingAccount::findOrFail($data['accountId']); $this->scope->authorize($user, $account->company_id);
        $payment = AccountingPayment::create($this->paymentData($data, $user));
        $this->audit->record($user, 'CREATE', 'AccountingPayment', $payment->id, $account->company_id, null, $payment->toArray());
        return response()->json(['data' => $this->payment($payment->load('account.company'))], 201);
    }

    public function updatePayment(Request $request, AccountingPayment $payment): JsonResponse
    {
        $user = $request->user(); abort_unless($user->isSuperAdmin() || $user->can('accounting.payments.manage'), 403); $payment->load('account'); $this->scope->authorize($user, $payment->account->company_id);
        $data = $this->validatePayment($request->all(), true); $before = $payment->toArray(); $payment->fill($this->paymentData($data, $user, false)); $payment->save();
        $this->audit->record($user, 'UPDATE', 'AccountingPayment', $payment->id, $payment->account->company_id, $before, $payment->toArray());
        return response()->json(['data' => $this->payment($payment->fresh('account.company'))]);
    }

    public function deletePayment(Request $request, AccountingPayment $payment): JsonResponse
    {
        $user = $request->user(); abort_unless($user->isSuperAdmin() || $user->can('accounting.payments.manage'), 403); $payment->load('account'); $this->scope->authorize($user, $payment->account->company_id); $payment->delete();
        $this->audit->record($user, 'DELETE', 'AccountingPayment', $payment->id, $payment->account->company_id);
        return response()->json(['message' => 'Payment deleted.']);
    }

    private function validateAccount(array $input, bool $partial = false): array
    {
        return Validator::make($input, [
            'companyId' => [$partial ? 'sometimes' : 'required', 'integer', 'exists:companies,id'],
            'employeeId' => ['nullable', 'integer', 'exists:employees,id'], 'vehicleId' => ['nullable', 'integer', 'exists:vehicles,id'],
            'accountType' => [$partial ? 'sometimes' : 'required', Rule::in(['monthly_fee','company_car_rent','personal_car_rent','qid_fee'])],
            'title' => ['required','string','max:255'], 'referenceNo' => ['nullable','string','max:100'],
            'startDate' => ['nullable','date'], 'endDate' => ['nullable','date','after_or_equal:startDate'],
            'amount' => ['nullable','numeric','min:0'], 'totalAmount' => ['nullable','numeric','min:0'],
            'downPaymentPercent' => ['nullable','numeric','min:0','max:100'], 'interestPercent' => ['nullable','numeric','min:0','max:100'],
            'programMonths' => ['nullable','integer','min:1'], 'status' => ['nullable', Rule::in(['active','completed','cancelled'])],
            'details' => ['nullable','array'], 'notes' => ['nullable','string','max:5000'],
        ])->validate();
    }

    private function validatePayment(array $input, bool $partial = false): array
    {
        return Validator::make($input, [
            'accountId' => [$partial ? 'sometimes' : 'required', 'integer', 'exists:accounting_accounts,id'],
            'paymentDate' => ['nullable','date'], 'dueDate' => ['nullable','date'], 'periodLabel' => ['nullable','string','max:100'],
            'amountDue' => ['required','numeric','min:0'], 'amountPaid' => ['required','numeric','min:0'],
            'voucherNo' => ['nullable','string','max:100'], 'paymentMethod' => ['nullable','string','max:50'],
            'notes' => ['nullable','string','max:2000'],
        ])->validate();
    }

    private function accountData(array $d, $user, bool $create, ?AccountingAccount $old = null): array
    {
        $map = ['company_id'=>'companyId','employee_id'=>'employeeId','vehicle_id'=>'vehicleId','account_type'=>'accountType','title'=>'title','reference_no'=>'referenceNo','start_date'=>'startDate','end_date'=>'endDate','amount'=>'amount','total_amount'=>'totalAmount','down_payment_percent'=>'downPaymentPercent','interest_percent'=>'interestPercent','program_months'=>'programMonths','status'=>'status','details'=>'details','notes'=>'notes'];
        $out = []; foreach ($map as $column => $key) if (array_key_exists($key, $d)) $out[$column] = $d[$key];
        $out['updated_by'] = $user->id; if ($create) $out['created_by'] = $user->id; return $out;
    }
    private function paymentData(array $d, $user, bool $create): array
    {
        $map = ['accounting_account_id'=>'accountId','payment_date'=>'paymentDate','due_date'=>'dueDate','period_label'=>'periodLabel','amount_due'=>'amountDue','amount_paid'=>'amountPaid','voucher_no'=>'voucherNo','payment_method'=>'paymentMethod','notes'=>'notes'];
        $out = []; foreach ($map as $column => $key) if (array_key_exists($key, $d)) $out[$column] = $d[$key];
        $paid = (float) ($out['amount_paid'] ?? 0); $due = (float) ($out['amount_due'] ?? 0); $out['status'] = $paid <= 0 ? 'due' : ($paid < $due ? 'partial' : 'paid'); if ($create) $out['created_by'] = $user->id; return $out;
    }
    private function account(AccountingAccount $a): array
    {
        $paid = (float) ($a->payments_sum_amount_paid ?? $a->payments()->sum('amount_paid')); $due = (float) ($a->payments_sum_amount_due ?? $a->payments()->sum('amount_due')); return ['id'=>(string)$a->id,'companyId'=>(string)$a->company_id,'companyName'=>$a->company?->name,'employeeId'=>$a->employee_id?(string)$a->employee_id:null,'employeeName'=>$a->employee?->full_name,'vehicleId'=>$a->vehicle_id?(string)$a->vehicle_id:null,'vehicleName'=>$a->vehicle?->vehicle_name ?: $a->vehicle?->vehicle_number,'accountType'=>$a->account_type,'title'=>$a->title,'referenceNo'=>$a->reference_no,'startDate'=>$a->start_date?->toDateString(),'endDate'=>$a->end_date?->toDateString(),'amount'=>(float)$a->amount,'totalAmount'=>$a->total_amount!==null?(float)$a->total_amount:null,'downPaymentPercent'=>$a->down_payment_percent!==null?(float)$a->down_payment_percent:null,'interestPercent'=>$a->interest_percent!==null?(float)$a->interest_percent:null,'programMonths'=>$a->program_months,'status'=>$a->status,'details'=>$a->details ?: [],'notes'=>$a->notes,'totalDue'=>$due,'totalPaid'=>$paid,'balance'=>max(0,$due-$paid),'createdAt'=>$a->created_at?->toIso8601String()];
    }
    private function payment(AccountingPayment $p): array { return ['id'=>(string)$p->id,'accountId'=>(string)$p->accounting_account_id,'accountTitle'=>$p->account?->title,'accountType'=>$p->account?->account_type,'companyId'=>(string)($p->account?->company_id ?? ''),'paymentDate'=>$p->payment_date?->toDateString(),'dueDate'=>$p->due_date?->toDateString(),'periodLabel'=>$p->period_label,'amountDue'=>(float)$p->amount_due,'amountPaid'=>(float)$p->amount_paid,'voucherNo'=>$p->voucher_no,'paymentMethod'=>$p->payment_method,'status'=>$p->status,'notes'=>$p->notes]; }
}
