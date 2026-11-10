<#-- Every email's layout, in the sign-in pages' Endstate look: horizon greys, one solid square panel. scripts/email-layout.mjs puts in Common's value for each token named in double
     braces, since email clients don't read CSS variables, and writes the result to src/email/html/template.ftl. -->
<#macro emailLayout>
<html lang="${locale.language}" dir="${(ltr)?then('ltr','rtl')}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark">
<style>.augur-email-body a { color: {{grey-9}}; text-decoration: underline; } .augur-email-body p { margin: 0 0 {{space-4}}; }</style>
</head>
<body style="margin:0;padding:0;background:{{grey-0}};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:{{grey-0}};">
<tr><td align="center" style="padding:{{edge}} {{edge-tight}};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:{{measure-decision}};background:{{grey-2}};border:1px solid {{grey-4}};border-radius:{{radius-card}};">
<tr><td style="padding:{{space-6}} {{edge}};font-family:{{font-sans}};font-size:{{type-body}};line-height:{{leading-body}};color:{{grey-8}};">
<#if properties.orgName?has_content><div style="font-weight:500;font-size:{{type-meta}};line-height:{{leading-meta}};color:{{grey-9}};margin-bottom:{{space-5}};">${properties.orgName}</div></#if>
<div class="augur-email-body">
<#nested>
</div>
</td></tr>
</table>
<div style="padding-top:{{space-5}};font-family:{{font-sans}};font-size:{{type-label}};font-weight:600;letter-spacing:{{tracking-mark}};text-transform:uppercase;color:{{grey-6}};">${realmName}</div>
</td></tr>
</table>
</body>
</html>
</#macro>
