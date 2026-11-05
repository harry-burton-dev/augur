<#-- Every email's layout. scripts/email-layout.mjs puts in Common's value for each token named in double
     braces, since email clients don't read CSS variables, and writes the result to src/email/html/template.ftl. -->
<#macro emailLayout>
<html lang="${locale.language}" dir="${(ltr)?then('ltr','rtl')}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark">
<style>.augur-email-body a { color: {{green}}; } .augur-email-body p { margin: 0 0 {{space-4}}; }</style>
</head>
<body style="margin:0;padding:0;background:{{slate-deep}};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:{{slate-deep}};">
<tr><td align="center" style="padding:{{edge}} {{edge-tight}};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:{{measure-decision}};background:{{slate}};border:1px solid {{hairline}};border-radius:{{radius-card}};">
<tr><td style="padding:{{space-6}} {{edge}};font-family:{{font-sans}};font-size:{{type-body}};line-height:{{leading-body}};color:{{ink}};">
<#if properties.orgName?has_content><div style="font-size:{{type-label}};line-height:{{leading-label}};letter-spacing:{{tracking-label}};text-transform:uppercase;color:{{ink-muted}};margin-bottom:{{space-5}};">${properties.orgName}</div></#if>
<div class="augur-email-body">
<#nested>
</div>
</td></tr>
</table>
<div style="padding-top:{{space-5}};font-family:{{font-sans}};font-size:{{type-label}};letter-spacing:{{tracking-mark}};text-transform:uppercase;color:{{ink-muted}};">${realmName}</div>
</td></tr>
</table>
</body>
</html>
</#macro>
