/**
 * The templates AUGUR's own emails are written in (ADR 0065), as React Email components. They carry no colours or
 * sizes of their own: mail clients draw them in their own look, and anything visual would have to come from the kit's
 * token files (ADR 0015), which a service can't read. Words are passed in, never written here.
 */
import { Body, Button, Container, Head, Heading, Hr, Html, Preview, Section, Text } from '@react-email/components';

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
}

/** A notice: a heading, a few paragraphs, maybe one link to act on it, and why it came. */
export function NoticeEmail({ productName, heading, lines, action, why }: NoticeEmailProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{lines[0] ?? heading}</Preview>
      <Body>
        <Container>
          <Text>{productName}</Text>
          <Heading as="h1">{heading}</Heading>
          {lines.map((line, i) => (
            <Text key={i}>{line}</Text>
          ))}
          {action ? (
            <Section>
              <Button href={action.url}>{action.label}</Button>
            </Section>
          ) : null}
          {why ? (
            <>
              <Hr />
              <Text>{why}</Text>
            </>
          ) : null}
        </Container>
      </Body>
    </Html>
  );
}
