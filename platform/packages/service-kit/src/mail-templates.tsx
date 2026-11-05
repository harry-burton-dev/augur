/**
 * The templates AUGUR's own emails are written in (ADR 0065), as React Email components. They carry no colours or
 * sizes of their own: mail clients draw them in their own look, and anything visual would have to come from the kit's
 * token files (ADR 0015), which a service can't read. Words are passed in, never written here. Plain elements are
 * enough for this; React Email's render turns them into HTML and plain text.
 */

export interface NoticeEmailProps {
  /** The product's name as people know it (ORG_PRODUCT_NAME). */
  productName: string;
  heading: string;
  /** One paragraph each. */
  lines: string[];
  /** Where to act on it, when there is somewhere: a link into AUGUR. */
  action?: { label: string; url: string };
  /** Why this person gets it, and how to stop: shown under a rule at the end. */
  why?: string;
  /** The language the words are in, as a language tag (default `en`). */
  lang?: string;
}

/** A notice: a heading, a few paragraphs, maybe one link to act on it, and why it came. */
export function NoticeEmail({ productName, heading, lines, action, why, lang = 'en' }: NoticeEmailProps) {
  return (
    <html lang={lang}>
      <head>
        <meta httpEquiv="Content-Type" content="text/html; charset=UTF-8" />
        <title>{heading}</title>
      </head>
      <body>
        <p>{productName}</p>
        <h1>{heading}</h1>
        {lines.map((line, i) => (
          <p key={i}>{line}</p>
        ))}
        {action ? (
          <p>
            <a href={action.url}>{action.label}</a>
          </p>
        ) : null}
        {why ? (
          <>
            <hr />
            <p>{why}</p>
          </>
        ) : null}
      </body>
    </html>
  );
}
