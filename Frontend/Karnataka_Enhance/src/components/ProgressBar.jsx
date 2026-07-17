function ProgressBar({ step, total }) {
  const percentage = Math.round((step / total) * 100);
  return (
    <div className="rounded-3xl bg-slate-200 p-2">
      <div className="mb-2 flex items-center justify-between text-sm font-medium text-slate-700">
        <span>Progress</span>
        <span>{percentage}%</span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-white">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}

export default ProgressBar;
