import Link from "next/link";
import type { ComponentProps } from "react";

type SmartLinkProps = Omit<ComponentProps<"a">, "href"> & { href: string };

/**
 * In-page anchors ("/#pricing") and external URLs render as plain <a> so the
 * smooth-scroll provider can animate them; app routes use next/link.
 */
export function SmartLink({ href, ...props }: SmartLinkProps) {
  const isHash = href.startsWith("#") || href.startsWith("/#");
  const isExternal = /^https?:\/\//.test(href);
  if (isHash || isExternal) {
    return <a href={href} {...(isExternal ? { target: "_blank", rel: "noopener noreferrer" } : {})} {...props} />;
  }
  return <Link href={href} {...props} />;
}
