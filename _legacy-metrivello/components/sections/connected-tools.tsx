import { tools } from "@/lib/content";

/** Infinite logo ticker (~24px/s like the reference), faded at both edges. */
export function ConnectedTools() {
  const loop = [...tools.items, ...tools.items];
  return (
    <section id="tools" className="bg-white px-5 pt-11 md:px-8 md:pt-[60px] lg:px-10 lg:pt-20">
      <div className="mx-auto flex max-w-[1600px] flex-col items-center gap-7">
        <p className="text-center text-small text-[#839088]">{tools.heading}</p>
        <div className="w-full overflow-hidden [mask-image:linear-gradient(90deg,transparent_0%,#000_12%,#000_88%,transparent_100%)]">
          <ul
            className="ticker-track flex h-12 w-max items-center [--ticker-duration:76s] lg:[--ticker-duration:80s]"
            aria-label="Supported integrations"
          >
            {loop.map((tool, i) => (
              <li
                key={`${tool.name}-${i}`}
                aria-hidden={i >= tools.items.length ? true : undefined}
                className="flex shrink-0 items-center gap-2.5 pr-12 lg:pr-16"
              >
                {tool.logo ? (
                  <span
                    aria-hidden="true"
                    className="block shrink-0 bg-[#6a7971]"
                    style={{
                      width: tool.w,
                      height: tool.h,
                      mask: `url(/images/logos/${tool.logo}.svg) center / contain no-repeat`,
                      WebkitMask: `url(/images/logos/${tool.logo}.svg) center / contain no-repeat`,
                    }}
                  />
                ) : null}
                <span className="text-body whitespace-nowrap text-[#6a7971]">{tool.name}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
