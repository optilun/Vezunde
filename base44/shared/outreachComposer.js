// outreachComposer — emailul final al unei campanii pentru un destinatar anume. Un singur loc,
// folosit de trimiterea reala, de emailul de test si de previzualizarea din admin, ca adminul sa
// vada exact ce pleaca.

import {
  buildEmailHtml,
  buildPlainText,
  renderTemplateMergeFields,
  textToHtml,
} from './outreachEmailPolicy.js';
import {
  normalizeCategory,
  footerReasonFor,
  unsubscribeLabelFor,
  eyebrowFor,
} from './outreachAudiencePolicy.js';

// Eticheta din fisa afisata in email. Un profil deja revendicat nu trebuie sa primeasca un email
// care ii spune ca e nerevendicat.
export function listingChipFor(controlStatus) {
  if (controlStatus === 'claimed') return 'Profil revendicat';
  if (controlStatus === 'verified') return 'Profil verificat';
  return 'Profil nerevendicat';
}

export function composeOutreachEmail(campaign = {}, contact = {}, { unsubscribeUrl = '', subject = '' } = {}) {
  const category = normalizeCategory(campaign.category);
  const unsubHtml = `<a href="${unsubscribeUrl}" style="color:#6b6b6b;text-decoration:underline;">${unsubscribeLabelFor(category)}</a>`;
  let bodyHtml = textToHtml(campaign.body_html || '');
  bodyHtml = renderTemplateMergeFields(bodyHtml, contact).replace(/\[UNSUBSCRIBE_LINK\]/g, unsubHtml);
  // Blocul vizual poarta datele REALE ale destinatarului: fiecare primeste fisa lui, cu numele
  // si orasul lui, nu o ilustratie generica. De aceea se construieste aici, per contact.
  const options = {
    ctaLabel: campaign.cta_label,
    ctaUrl: campaign.cta_url,
    showcase: campaign.show_listing_preview === false ? null : {
      name: contact.company_name,
      providerType: contact.provider_type,
      city: contact.city,
      county: contact.county,
      chip: listingChipFor(contact.profile_control_status),
      emailScope: contact.email_scope || 'location',
    },
    reason: footerReasonFor(contact) || undefined,
    eyebrow: eyebrowFor(category) || undefined,
  };
  const finalSubject = subject || campaign.subject || 'VIASEE';
  return {
    subject: finalSubject,
    html: buildEmailHtml(bodyHtml, unsubHtml, finalSubject, options),
    text: buildPlainText(bodyHtml, unsubscribeUrl, options),
  };
}
