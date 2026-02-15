'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, ExternalLink, BookOpen, FileCheck } from 'lucide-react';

const CHECKLIST = {
  'Phase 1: Planning & Preparation': [
    'Prescribed Burn Plan Written & Approved',
    'Valid Burn Permit Obtained',
    'Risk Assessment & Go/No-Go Parameters Defined',
    'Contingency Plan (Escape Routes, Resources)',
    'Smoke Management Plan & Sensitive Receptors Identified',
  ],
  'Phase 2: On-Site Actions': [
    'On-Site Weather Verified Against Prescription',
    'Equipment & Personnel Inspected & Ready',
    'Firebreaks Confirmed Secure',
    'Crew Briefing Conducted',
    'Test Fire Conducted & Evaluated',
  ],
  'Phase 3: Communication': [
    'Required Notifications Made (911, Fire Dept, MFC)',
    'Neighbors & Stakeholders Notified',
  ],
};

const TOTAL_ITEMS = Object.values(CHECKLIST).flat().length;

export default function SafetyPage() {
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const toggleItem = (item: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(item)) next.delete(item);
      else next.add(item);
      return next;
    });
  };

  const checkedCount = checked.size;
  const allChecked = checkedCount === TOTAL_ITEMS;

  return (
    <div className="space-y-4">
      {/* Go/No-Go Checklist */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-slate-500 flex items-center gap-2">
              <FileCheck className="h-4 w-4" />
              Pre-Burn Go/No-Go Checklist
            </CardTitle>
            <Badge
              variant={allChecked ? 'default' : 'secondary'}
              className={allChecked ? 'bg-green-600' : checkedCount > 0 ? 'bg-yellow-500 text-black' : ''}
            >
              {checkedCount} / {TOTAL_ITEMS} Complete
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {Object.entries(CHECKLIST).map(([phase, items]) => (
              <div key={phase}>
                <h4 className="text-sm font-semibold text-slate-700 mb-3">{phase}</h4>
                <div className="space-y-2">
                  {items.map((item) => (
                    <div key={item} className="flex items-center gap-3">
                      <Checkbox
                        id={item}
                        checked={checked.has(item)}
                        onCheckedChange={() => toggleItem(item)}
                      />
                      <Label
                        htmlFor={item}
                        className={`text-sm cursor-pointer ${
                          checked.has(item) ? 'text-green-700 line-through' : 'text-slate-700'
                        }`}
                      >
                        {item}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Important Reminders */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-slate-500 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Important Reminders
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              { title: 'Red Flag Warnings', text: 'Never burn when a Red Flag Warning is in effect. Check NWS alerts before any ignition.' },
              { title: 'Smoke Management', text: 'Ensure adequate ventilation index (VI > 20,000). Monitor smoke drift direction and nearby sensitive receptors.' },
              { title: 'Escape Routes', text: 'Maintain at least 2 escape routes at all times. Brief all crew on rally points.' },
              { title: 'Weather Monitoring', text: 'Continuously monitor weather during burn operations. Be prepared to suppress if conditions change.' },
            ].map((r) => (
              <div key={r.title} className="bg-amber-50 border border-amber-100 rounded-lg p-3">
                <p className="text-sm font-semibold text-amber-800">{r.title}</p>
                <p className="text-xs text-amber-700 mt-1">{r.text}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Fire Weather Resources */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-slate-500 flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Fire Weather Indices Reference
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            {[
              { term: 'Ventilation Index (VI)', desc: 'Mixing Height × Transport Wind Speed. Measures atmosphere\'s ability to disperse smoke. >40,000 = good, <20,000 = poor.' },
              { term: 'KBDI (Keetch-Byram)', desc: 'Long-term drought indicator (0-800). Higher values = drier fuels, faster fire spread.' },
              { term: 'FFMC (Fine Fuel Moisture)', desc: 'Moisture in 1-hour fuels. >92 = extreme ignition potential.' },
              { term: 'Haines Index', desc: 'Atmosphere stability and moisture indicator (2-6). ≥5 = elevated large fire potential.' },
              { term: 'Mixing Height', desc: 'Height of convective boundary layer. Higher = better smoke dispersal.' },
              { term: 'Transport Wind', desc: 'Wind speed through mixing layer. Determines how fast smoke moves away from source.' },
            ].map((item) => (
              <div key={item.term} className="border rounded-lg p-3">
                <p className="font-semibold text-slate-700">{item.term}</p>
                <p className="text-xs text-slate-500 mt-1">{item.desc}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Useful Links */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-slate-500 flex items-center gap-2">
            <ExternalLink className="h-4 w-4" />
            Useful Links
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {[
              { label: 'NWS Fire Weather', url: 'https://www.weather.gov/fire' },
              { label: 'NWCG Prescribed Fire Resources', url: 'https://www.nwcg.gov/publications/pms484' },
              { label: 'Spot Forecast Request', url: 'https://spot.weather.gov/new-request' },
              { label: 'InciWeb Incidents', url: 'https://inciweb.nwcg.gov/' },
              { label: 'SPC Fire Weather Outlook', url: 'https://www.spc.noaa.gov/products/fire_wx/' },
              { label: 'Mississippi Forestry Commission', url: 'https://www.mfc.ms.gov/' },
            ].map((link) => (
              <a
                key={link.label}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 p-2 rounded hover:bg-blue-50"
              >
                <ExternalLink className="h-3 w-3" />
                {link.label}
              </a>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Disclaimer */}
      <div className="text-xs text-slate-400 p-2">
        <p className="font-medium text-slate-500 mb-1">Disclaimer</p>
        <p>
          This dashboard is a decision-support tool only. All burn decisions must be made by
          qualified prescribed fire managers using current field conditions. Always verify
          conditions on-site before ignition. The developers and MDEQ assume no liability for
          burn outcomes based on this tool&apos;s data.
        </p>
      </div>
    </div>
  );
}
