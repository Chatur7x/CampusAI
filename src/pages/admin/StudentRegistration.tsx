import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

const steps = ['Personal Details', 'Academic Details', 'Address Details'];

const addressData = {
  Telangana: {
    Hyderabad: {
      cities: {
        Hyderabad: {
          mandals: {
            Madhapur: '500081',
            Kukatpally: '500072',
            Gachibowli: '500032',
          },
        },
      },
    },
    Rangareddy: {
      cities: {
        Shamshabad: {
          mandals: {
            Shamshabad: '501218',
            Kothur: '509228',
          },
        },
      },
    },
  },
  Karnataka: {
    'Bengaluru Urban': {
      cities: {
        Bengaluru: {
          mandals: {
            Whitefield: '560066',
            Indiranagar: '560038',
            Jayanagar: '560041',
          },
        },
      },
    },
  },
  Maharashtra: {
    Mumbai: {
      cities: {
        Mumbai: {
          mandals: {
            Andheri: '400053',
            Powai: '400076',
            Bandra: '400050',
          },
        },
      },
    },
  },
};

const initialForm = {
  firstName: '',
  middleName: '',
  lastName: '',
  email: '',
  phone: '',
  gender: '',
  dob: '',
  fatherName: '',
  motherName: '',
  parentsMobile: '',
  bloodGroup: '',
  rollNumber: '',
  admissionNumber: '',
  batch: '',
  degree: '',
  programCode: '',
  semester: '',
  country: 'India',
  state: 'Telangana',
  district: 'Hyderabad',
  city: 'Hyderabad',
  mandal: 'Madhapur',
  pincode: '500081',
  plotNo: '',
  streetNo: '',
  apartment: '',
  doorNo: '',
  landmark: '',
};

type FormState = typeof initialForm;

export default function StudentRegistrationPage() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const availableDistricts = useMemo(() => Object.keys(addressData[form.state] || {}), [form.state]);
  const availableCities = useMemo(() => {
    const districts = addressData[form.state] || {};
    const districtData = districts[form.district] || {};
    return Object.keys(districtData.cities || {});
  }, [form.state, form.district]);
  const availableMandals = useMemo(() => {
    const cityData = addressData[form.state]?.[form.district]?.cities?.[form.city];
    return cityData ? Object.keys(cityData.mandals) : [];
  }, [form.state, form.district, form.city]);

  const handleChange = (key: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleStateChange = (state: string) => {
    const districts = Object.keys(addressData[state] || {});
    const district = districts[0] || '';
    const cities = district ? Object.keys(addressData[state][district].cities) : [];
    const city = cities[0] || '';
    const mandals = city ? Object.keys(addressData[state][district].cities[city].mandals) : [];
    const mandal = mandals[0] || '';
    const pincode = mandal ? addressData[state][district].cities[city].mandals[mandal] : '';
    setForm((prev) => ({
      ...prev,
      state,
      district,
      city,
      mandal,
      pincode,
    }));
  };

  const handleDistrictChange = (district: string) => {
    const cities = district ? Object.keys(addressData[form.state][district].cities) : [];
    const city = cities[0] || '';
    const mandals = city ? Object.keys(addressData[form.state][district].cities[city].mandals) : [];
    const mandal = mandals[0] || '';
    const pincode = mandal ? addressData[form.state][district].cities[city].mandals[mandal] : '';
    setForm((prev) => ({
      ...prev,
      district,
      city,
      mandal,
      pincode,
    }));
  };

  const handleCityChange = (city: string) => {
    const mandals = city ? Object.keys(addressData[form.state][form.district].cities[city].mandals) : [];
    const mandal = mandals[0] || '';
    const pincode = mandal ? addressData[form.state][form.district].cities[city].mandals[mandal] : '';
    setForm((prev) => ({
      ...prev,
      city,
      mandal,
      pincode,
    }));
  };

  const handleMandalChange = (mandal: string) => {
    const pincode = mandal ? addressData[form.state][form.district].cities[form.city].mandals[mandal] : '';
    setForm((prev) => ({
      ...prev,
      mandal,
      pincode,
    }));
  };

  const onSubmit = async () => {
    setSubmitting(true);
    await new Promise((res) => setTimeout(res, 800));
    setSubmitting(false);
    setSubmitted(true);
    toast.success('Student registered • Credentials emailed');
  };

  const renderStep = () => {
    if (step === 0) {
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="First Name" value={form.firstName} onChange={(v) => handleChange('firstName', v)} required />
          <Field label="Middle Name" value={form.middleName} onChange={(v) => handleChange('middleName', v)} />
          <Field label="Last Name" value={form.lastName} onChange={(v) => handleChange('lastName', v)} required />
          <Field label="Email" type="email" value={form.email} onChange={(v) => handleChange('email', v)} required />
          <Field label="Phone" value={form.phone} onChange={(v) => handleChange('phone', v)} required />
          <Field label="Gender" value={form.gender} onChange={(v) => handleChange('gender', v)} placeholder="Male / Female / Other" />
          <Field label="Date of Birth" type="date" value={form.dob} onChange={(v) => handleChange('dob', v)} />
          <Field label="Blood Group" value={form.bloodGroup} onChange={(v) => handleChange('bloodGroup', v)} />
          <Field label="Father's Name" value={form.fatherName} onChange={(v) => handleChange('fatherName', v)} />
          <Field label="Mother's Name" value={form.motherName} onChange={(v) => handleChange('motherName', v)} />
          <Field label="Parents Mobile" value={form.parentsMobile} onChange={(v) => handleChange('parentsMobile', v)} />
        </div>
      );
    }

    if (step === 1) {
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Roll Number" value={form.rollNumber} onChange={(v) => handleChange('rollNumber', v)} required />
          <Field label="Admission Number" value={form.admissionNumber} onChange={(v) => handleChange('admissionNumber', v)} required />
          <Field label="Batch" value={form.batch} onChange={(v) => handleChange('batch', v)} placeholder="2024-2028" />
          <Field label="Degree" value={form.degree} onChange={(v) => handleChange('degree', v)} placeholder="B.Tech" />
          <Field label="Program Code" value={form.programCode} onChange={(v) => handleChange('programCode', v)} placeholder="CSE" />
          <Field label="Semester" value={form.semester} onChange={(v) => handleChange('semester', v)} placeholder="1-8" />
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Country" value={form.country} onChange={(v) => handleChange('country', v)} disabled />
        <SelectField label="State" value={form.state} options={Object.keys(addressData)} onChange={handleStateChange} />
        <SelectField label="District" value={form.district} options={availableDistricts} onChange={handleDistrictChange} />
        <SelectField label="City" value={form.city} options={availableCities} onChange={handleCityChange} />
        <SelectField label="Mandal" value={form.mandal} options={availableMandals} onChange={handleMandalChange} />
        <Field label="Pincode" value={form.pincode} onChange={(v) => handleChange('pincode', v)} disabled />
        <Field label="Plot No" value={form.plotNo} onChange={(v) => handleChange('plotNo', v)} />
        <Field label="Street No" value={form.streetNo} onChange={(v) => handleChange('streetNo', v)} />
        <Field label="Apartment" value={form.apartment} onChange={(v) => handleChange('apartment', v)} />
        <Field label="Door No" value={form.doorNo} onChange={(v) => handleChange('doorNo', v)} />
        <Field label="Landmark" value={form.landmark} onChange={(v) => handleChange('landmark', v)} />
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">New Student Registration</h1>
          <p className="text-slate-400">Three-step intake with India address auto-fill.</p>
        </div>
        <Badge className="bg-emerald-500/20 text-emerald-300">Faculty/Admin only</Badge>
      </div>

      <Card className="bg-slate-900/60 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white text-lg">{steps[step]}</CardTitle>
          <div className="flex gap-2 text-xs text-slate-400">
            {steps.map((label, idx) => (
              <div
                key={label}
                className={`flex-1 h-1 rounded-full ${idx <= step ? 'bg-emerald-400' : 'bg-slate-800'}`}
              />
            ))}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {renderStep()}

          <div className="flex justify-between pt-4">
            <Button variant="ghost" disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}>
              Back
            </Button>
            {step < steps.length - 1 ? (
              <Button onClick={() => setStep((s) => Math.min(steps.length - 1, s + 1))}>
                Next
              </Button>
            ) : (
              <Button onClick={onSubmit} disabled={submitting}>
                {submitting ? 'Submitting…' : 'Submit & Notify'}
              </Button>
            )}
          </div>

          {submitted && (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">
              Student saved. Admin + faculty notified; credentials will be emailed to the student.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

interface FieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
}

function Field({ label, value, onChange, type = 'text', placeholder, required, disabled }: FieldProps) {
  return (
    <label className="space-y-1 text-sm text-slate-300 flex flex-col">
      <span className="flex items-center gap-2">
        {label}
        {required ? <span className="text-red-400">*</span> : null}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        type={type}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-white placeholder:text-slate-500 disabled:opacity-70"
      />
    </label>
  );
}

interface SelectFieldProps {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}

function SelectField({ label, value, options, onChange }: SelectFieldProps) {
  return (
    <label className="space-y-1 text-sm text-slate-300 flex flex-col">
      <span>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-white"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}
