import Image from "next/image";
import Link from "next/link";
import type { Article } from "@/lib/articles";
import { ArrowRightIcon } from "./ui/icons";

type ArticleCardProps = Pick<Article, "slug" | "category" | "title" | "excerpt" | "cover">;

/** Journal card: illustration, category, title, excerpt; border turns green on hover. */
export function ArticleCard({ slug, category, title, excerpt, cover }: ArticleCardProps) {
  return (
    <Link
      href={`/blog/${slug}`}
      className="group flex flex-col gap-2 rounded-[20px] bg-white p-3 shadow-[inset_0_0_0_1px_#e2eae5] transition-shadow duration-300 ease-framer hover:shadow-[inset_0_0_0_1px_#16aa68]"
    >
      <div className="relative aspect-[1.6] w-full overflow-hidden rounded-[13px]">
        <Image src={cover} alt="" fill unoptimized className="object-cover" />
      </div>
      <div className="flex flex-col gap-3.5 px-3.5 py-6">
        <p className="text-eyebrow text-[#0a8950]">{category}</p>
        <h3 className="text-h3 text-ink">{title}</h3>
        <p className="text-small text-[#68796d]">{excerpt}</p>
        <span className="flex items-center gap-2 py-[3px] text-button text-ink">
          Read article
          <ArrowRightIcon size={16} />
        </span>
      </div>
    </Link>
  );
}
