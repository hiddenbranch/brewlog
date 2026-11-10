/* Brew Log registration. This is the only file to edit to switch registration on, off, or change how it behaves.
   Edit it on GitHub (pencil icon) and commit. Every copy of the app picks it up the next time it opens online,
   usually within ten minutes. No version bump needed.

   With signup left as '' there is no registration at all and the app works exactly as before.

   TO SWITCH IT ON, paste one link between the quotes after signup. The quickest is a Google Form (free, no limit,
   sign-ups land in a Google Sheet you own):
     1. forms.google.com > blank form. Add three "Short answer" questions: Email, First name, What do you brew on.
        Leave "Collect email addresses" OFF and make none of them required. In Settings > Responses, make sure
        "Limit to 1 response" is off, so nobody has to sign in to Google.
     2. Responses tab > "Link to Sheets", so every sign-up becomes a row.
     3. Three dots (top right) > "Get pre-filled link". In the form that opens, type EMAIL as the answer to the
        email question, NAME for the first name, SYSTEM for the brewing question. Press "Get link", then "Copy link".
     4. Paste that link below, between the quotes. Commit.
     5. Check it: open https://hiddenbranch.github.io/brewlog/?register and press "Send a test sign-up".
        A new row should appear in the sheet.
   If you ever add, delete or reorder the questions, make a fresh pre-filled link and paste it again.

   A mailing-list service works the same way if you would rather have welcome emails and unsubscribe links looked
   after for you: paste the address its sign-up form posts to (Kit, Mailchimp and Buttondown are recognised; anything
   else is sent the fields email, name and system).

   when:  'save'  people can look around freely, and are asked to register when they save their first batch
                  or press Install. Shop links and carts are never behind it.
          'open'  nothing can be used until they register.
          'off'   no registration, even with a link pasted in.
   perk:  the sentence under the form saying what registering gets them. Only promise what you will send.
   privacy: a link to a privacy page, if you have one.
   contact: an email address or a link. If set, Settings shows "Report a problem or ask for something". */
window.BREWLOG_REGISTER = {
  signup: '',
  when: 'save',
  perk: 'You will get an occasional email about new recipes, new features and the Brew Log book.',
  privacy: '',
  contact: ''
};
