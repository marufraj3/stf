<?php

namespace App\Http\Controllers;

use App\Models\BankDocument;
use App\Models\Employee;
use App\Services\ApiPresenter;
use App\Services\AuditService;
use App\Services\CompanyScope;
use App\Services\FileStorageService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class BankDocumentController extends Controller
{
    public function __construct(private readonly CompanyScope $scope, private readonly ApiPresenter $presenter, private readonly FileStorageService $files, private readonly AuditService $audit){}

    public function index(Request $request): JsonResponse
    {
        $user=$request->user();
        abort_unless($user->isSuperAdmin()||$user->can('employees.view'),403);
        $q=BankDocument::query();
        $this->scope->apply($q,$user);
        if($request->filled('company_id')){ $cid=(int)$request->input('company_id'); $this->scope->authorize($user,$cid); $q->where('company_id',$cid);}
        if($search=trim((string)$request->input('search'))){ $q->where(fn($x)=>$x->where('employee_name','like',"%$search%")->orWhere('iban_number','like',"%$search%")->orWhere('account_phone','like',"%$search%")); }
        if($request->filled('expiry_status')){
            $today=now('Asia/Qatar')->toDateString();
            match($request->input('expiry_status')){
                'expired'=>$q->whereNotNull('bank_card_expiry_date')->whereDate('bank_card_expiry_date','<',$today),
                'valid'=>$q->whereDate('bank_card_expiry_date','>',$today),
                default=>null
            };
        }
        $sort=in_array($request->input('sort_by'),['employee_name','bank_card_expiry_date','created_at'],true)?$request->input('sort_by'):'created_at';
        $dir=$request->input('direction')==='asc'?'asc':'desc';
        $perPage=min(100,max(1,$request->integer('per_page',20)));
        $p=$q->orderBy($sort,$dir)->paginate($perPage);
        $p->setCollection($p->getCollection()->map(fn(BankDocument $m)=>$this->presenter->bankDocument($m)));
        return response()->json($p);
    }

    public function store(Request $r): JsonResponse
    {
        $user=$r->user(); abort_unless($user->isSuperAdmin()||$user->can('employees.create'),403);
        $data=$this->validateData($r->all());
        $this->scope->authorize($user,$data['companyId']);
        $emp=Employee::findOrFail($data['employeeId']);
        abort_unless((int)$emp->company_id===(int)$data['companyId'],422,'Employee company mismatch');
        $file=$this->files->storeDataUrl($r->input('bankDocument'),(int)$data['companyId'],$user,$r->input('bankDocumentFileName')??'bank-doc',['image/jpeg','image/png','application/pdf']);
        $bd=BankDocument::create([
            'company_id'=>$data['companyId'],
            'employee_id'=>$data['employeeId'],
            'employee_name'=>$emp->full_name,
            'employee_code'=>$emp->employee_code,
            'account_phone'=>$data['accountPhoneNumber']??null,
            'account_phone_owner'=>$data['accountPhoneOwner']??'company',
            'personal_phone'=>$data['personalPhoneNumber']??null,
            'nationality'=>$data['nationality']??null,
            'iban_number'=>$data['ibanNumber']??null,
            'bank_card_expiry_date'=>$data['bankCardExpiryDate']??null,
            'bank_file_id'=>$file?->id,
            'notes'=>$data['notes']??null,
            'created_by'=>$user->id,'updated_by'=>$user->id,
        ]);
        $this->audit->record($user,'CREATE_BANK_DOCUMENT','BankDocument',$bd->id,(int)$bd->company_id,null,$bd->toArray(),$r);
        return response()->json(['data'=>$this->presenter->bankDocument($bd)],201);
    }

    public function update(Request $r,int $id): JsonResponse
    {
        $user=$r->user(); abort_unless($user->isSuperAdmin()||$user->can('employees.update'),403);
        $bd=BankDocument::findOrFail($id); $this->scope->authorize($user,$bd->company_id);
        $data=$this->validateData($r->all(),true);
        $before=$bd->toArray();
        $companyId=$data['companyId']??$bd->company_id;
        $this->scope->authorize($user,$companyId);
        if(!empty($data['employeeId']) && (int)$data['employeeId']!== (int)$bd->employee_id){
            $emp=Employee::findOrFail($data['employeeId']); $bd->employee_id=$emp->id; $bd->employee_name=$emp->full_name; $bd->employee_code=$emp->employee_code;
        }
        $file=$this->files->storeDataUrl($r->input('bankDocument'),(int)$companyId,$user,$r->input('bankDocumentFileName')??'bank-doc',['image/jpeg','image/png','application/pdf']);
        $bd->fill([
            'company_id'=>$companyId,
            'account_phone'=>$data['accountPhoneNumber']??$bd->account_phone,
            'account_phone_owner'=>$data['accountPhoneOwner']??$bd->account_phone_owner,
            'personal_phone'=>$data['personalPhoneNumber']??$bd->personal_phone,
            'nationality'=>$data['nationality']??$bd->nationality,
            'iban_number'=>$data['ibanNumber']??$bd->iban_number,
            'bank_card_expiry_date'=>$data['bankCardExpiryDate']??$bd->bank_card_expiry_date,
            'notes'=>$data['notes']??$bd->notes,
            'updated_by'=>$user->id,
        ]);
        if($file) $bd->bank_file_id=$file->id;
        if($r->boolean('removeBankDocument')) $bd->bank_file_id=null;
        $bd->save();
        $this->audit->record($user,'UPDATE_BANK_DOCUMENT','BankDocument',$bd->id,(int)$bd->company_id,$before,$bd->toArray(),$r);
        return response()->json(['data'=>$this->presenter->bankDocument($bd)]);
    }

    public function destroy(Request $r,int $id): JsonResponse
    {
        $user=$r->user(); abort_unless($user->isSuperAdmin()||$user->can('employees.archive'),403);
        $bd=BankDocument::findOrFail($id); $this->scope->authorize($user,$bd->company_id);
        $before=$bd->toArray(); $bd->delete();
        $this->audit->record($user,'DELETE_BANK_DOCUMENT','BankDocument',$id,(int)$before['company_id'],$before,null,$r);
        return response()->json(['message'=>'Deleted']);
    }

    private function validateData(array $d,bool $partial=false): array
    {
        $rules=[
            'companyId'=>[$partial?'sometimes':'required','integer','exists:companies,id'],
            'employeeId'=>[$partial?'sometimes':'required','integer','exists:employees,id'],
            'accountPhoneNumber'=>['nullable','string','max:40'],
            'accountPhoneOwner'=>['nullable',Rule::in(['company','employee'])],
            'personalPhoneNumber'=>['nullable','string','max:40'],
            'nationality'=>['nullable','string','max:100'],
            'ibanNumber'=>['nullable','string','max:80'],
            'bankCardExpiryDate'=>['nullable','date'],
            'notes'=>['nullable','string','max:2000'],
        ];
        return Validator::make($d,$rules)->validate();
    }
}
