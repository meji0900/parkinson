import clsx from "clsx";
import type { Block } from "@/lib/articles";

/** Long-form rich text (articles, legal pages): 18/31.5 body, 30px section headings. */
export function Prose({ blocks, className }: { blocks: Block[]; className?: string }) {
  return (
    <div
      className={clsx(
        "w-full text-[18px] leading-[1.75] tracking-[-0.1px] text-ink",
        "[&>*+*]:mt-5 [&>h2]:text-[30px] [&>h2]:leading-[1.2] [&>h2]:font-medium [&>h2]:tracking-[-0.8px] [&>*+h2]:mt-10",
        "[&>h3]:text-h3 [&>*+h3]:mt-8 [&>ol]:list-decimal [&>ol]:pl-[23px] [&>ul]:list-disc [&>ul]:pl-[23px]",
        className,
      )}
    >
      {blocks.map((block, i) => {
        switch (block.type) {
          case "h2":
            return <h2 key={i}>{block.text}</h2>;
          case "h3":
            return <h3 key={i}>{block.text}</h3>;
          case "ul":
          case "ol": {
            const List = block.type;
            return (
              <List key={i}>
                {block.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </List>
            );
          }
          default:
            return <p key={i}>{block.text}</p>;
        }
      })}
    </div>
  );
}
