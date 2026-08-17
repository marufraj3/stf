<?php

namespace App\Http\Controllers;

use App\Models\Employee;
use App\Models\EmployeeMessage;
use App\Services\ApiPresenter;
use App\Services\AuditService;
use App\Services\CompanyScope;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class EmployeeMessageController extends Controller
{
    public function __construct(private readonly CompanyScope $scope, private readonly ApiPresenter $presenter, private readonly AuditService $audit){}

    public function index(Request $r): JsonResponse
    {
        $user=$r->user(); abort_unless($user->isSuperAdmin()||$user->can('employees.view'),403);
        $q=EmployeeMessage::with('sender');
        $this->scope->apply($q,$user);
        if($r->filled('company_id')){ $cid=(int)$r->input('company_id'); $this->scope->authorize($user,$cid); $q->where('company_id',$cid);}
        if($r->filled('employee_id')) $q->where('employee_id',$r->integer('employee_id'));
        if($s=trim((string)$r->input('search'))){ $q->where(fn($x)=>$x->where('employee_name','like',"%$s%")->orWhere('message_body','like',"%$s%")); }
        $perPage=min(100,max(1,$r->integer('per_page',20)));
        $p=$q->orderBy('created_at','desc')->paginate($perPage);
        $p->setCollection($p->getCollection()->map(fn(EmployeeMessage $m)=>$this->presenter->employeeMessage($m)));
        return response()->json($p);
    }

    public function store(Request $r): JsonResponse
    {
        $user=$r->user(); abort_unless($user->isSuperAdmin()||$user->can('employees.create'),403);
        $v=Validator::make($r->all(),[
            'companyId'=>['required','integer','exists:companies,id'],
            'employeeId'=>['required','integer','exists:employees,id'],
            'employeeIds'=>['sometimes','array'],
            'employeeIds.*'=>['integer','exists:employees,id'],
            'subject'=>['nullable','string','max:255'],
            'messageBody'=>['required','string','max:5000'],
        ])->validate();
        $this->scope->authorize($user,$v['companyId']);
        $ids=!empty($v['employeeIds'])?$v['employeeIds']:[$v['employeeId']];
        $created=[];
        foreach($ids as $eid){
            $emp=Employee::findOrFail($eid);
            $m=EmployeeMessage::create([
                'company_id'=>$v['companyId'],
                'employee_id'=>$emp->id,
                'employee_name'=>$emp->full_name,
                'subject'=>$v['subject']??null,
                'message_body'=>$v['messageBody'],
                'channel'=>'internal',
                'status'=>'sent',
                'created_by'=>$user->id,
            ]);
            $this->audit->record($user,'SEND_EMPLOYEE_MESSAGE','EmployeeMessage',$m->id,(int)$m->company_id,null,$m->toArray(),$r);
            $created[]=$this->presenter->employeeMessage($m);
        }
        return response()->json(['data'=>count($created)===1?$created[0]:$created],201);
    }
}
