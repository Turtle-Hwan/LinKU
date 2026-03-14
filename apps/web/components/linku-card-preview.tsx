import { FEATURES, SERVICES } from "@linku/core";

export function LinkuCardPreview() {
  const items = [
    FEATURES[0].title,
    FEATURES[1].title,
    SERVICES[0].title,
    SERVICES[1].title,
    SERVICES[2].title,
    "Library seats",
  ];

  return (
    <div className="relative mx-auto flex h-[600px] w-full max-w-[500px] flex-col overflow-hidden rounded-[2rem] border border-white/50 bg-[linear-gradient(180deg,rgba(19,58,44,0.98),rgba(11,28,22,0.98))] p-5 shadow-[0_40px_140px_rgba(10,22,18,0.45)]">
      <div className="mb-4 flex items-center justify-between rounded-full border border-white/10 bg-white/8 px-4 py-3 text-sm text-white/80">
        <span className="font-medium uppercase tracking-[0.18em]">LinKU Popup</span>
        <span>500 x 600</span>
      </div>
      <div className="grid flex-1 grid-cols-2 gap-3">
        {items.map((item, index) => (
          <div
            key={item}
            className={`rounded-[1.4rem] border border-white/10 p-4 ${
              index % 3 === 0
                ? "col-span-2 bg-[#d8f279] text-[#0f231d]"
                : "bg-white/8 text-white"
            }`}
          >
            <div className="mb-8 text-xs uppercase tracking-[0.18em] opacity-70">
              quick access
            </div>
            <div className="text-lg font-semibold leading-tight">{item}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
