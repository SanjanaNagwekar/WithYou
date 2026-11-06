'use client';

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from 'recharts';

const decisionData = [
  { metric: 'Speaker similarity', Cartesia: 90.6, ElevenLabs: 9.4, cartesiaCount: '48 of 53', elevenCount: '5 of 53' },
  { metric: 'Naturalness', Cartesia: 95, ElevenLabs: 5, cartesiaCount: '38 of 40', elevenCount: '2 of 40' },
];

function DecisionTooltip({ active, label, payload }: TooltipContentProps) {
  if (!active || !payload?.length) return null;
  const datum = decisionData.find((item) => item.metric === label);

  return (
    <div className="decision-tooltip">
      <span>{label}</span>
      {payload.map((entry) => (
        <p key={String(entry.dataKey)}>
          <i style={{ background: String(entry.color) }} />
          <strong>{entry.name}</strong>
          <b>{Number(entry.value).toFixed(1)}%</b>
          <small>{entry.name === 'Cartesia' ? datum?.cartesiaCount : datum?.elevenCount} decisions</small>
        </p>
      ))}
    </div>
  );
}

export function ResearchDecisionChart() {
  return (
    <div className="decision-study">
      <div className="decision-chart" role="img" aria-label="Cartesia and ElevenLabs preference percentages for speaker similarity and naturalness">
        <div className="decision-chart-title"><span>NON-TIED PREFERENCE</span><small>Hover or tap for exact counts</small></div>
        <ResponsiveContainer
          width="100%"
          height="100%"
          minWidth={0}
          initialDimension={{ width: 800, height: 400 }}
        >
          <LineChart data={decisionData} margin={{ top: 34, right: 38, bottom: 22, left: 6 }}>
            <CartesianGrid vertical={false} stroke="#d8d1c6" strokeDasharray="2 7" />
            <ReferenceLine y={50} stroke="#aaa397" strokeDasharray="4 7" />
            <XAxis dataKey="metric" axisLine={false} tickLine={false} tick={{ fill: '#5f665f', fontSize: 11 }} dy={13} />
            <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} axisLine={false} tickLine={false} tick={{ fill: '#939087', fontSize: 9 }} width={38} unit="%" />
            <Tooltip content={DecisionTooltip} cursor={{ stroke: '#9a9388', strokeDasharray: '3 5' }} />
            <Line type="monotone" dataKey="Cartesia" stroke="#6f826d" strokeWidth={4} dot={{ r: 7, fill: '#6f826d', stroke: '#f8f4ed', strokeWidth: 3 }} activeDot={{ r: 10, fill: '#6f826d', stroke: '#f8f4ed', strokeWidth: 4 }} animationDuration={1200} />
            <Line type="monotone" dataKey="ElevenLabs" stroke="#ae7d73" strokeWidth={3} dot={{ r: 6, fill: '#ae7d73', stroke: '#f8f4ed', strokeWidth: 3 }} activeDot={{ r: 9, fill: '#ae7d73', stroke: '#f8f4ed', strokeWidth: 4 }} animationBegin={180} animationDuration={1200} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <aside className="decision-notes">
        <div className="decision-legend"><span className="cartesia">Cartesia</span><span className="eleven">ElevenLabs</span></div>
        <article><span>IDENTITY</span><strong>48 / 53</strong><p>non-tied speaker-similarity decisions preferred Cartesia</p></article>
        <article><span>NATURALNESS</span><strong>38 / 40</strong><p>non-tied naturalness decisions preferred Cartesia</p></article>
        <article className="latency-note"><span>MEDIAN LATENCY</span><strong>604<small>ms</small></strong><p>faster with Cartesia in the initial benchmark</p></article>
      </aside>
    </div>
  );
}
