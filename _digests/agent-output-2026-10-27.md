<Update label="October 27, 2026" tags={["Air"]}>

## New

### Patient communications on an appointment type
_Rolls out with next release · Admins, Front desk_

Check **Don't send patient communications for this appointment type** to turn off patient communications for every visit of that type, such as a workers' comp nurse case manager visit or a progress call. Patients on a visit of that type do not receive reminders, cancellation texts, intake forms, insurance requests, or kiosk check-in codes. The visit stays off the patient portal and the kiosk, and patients cannot book the type themselves. Outreach flows are separate, so use the **Appointment Type** filter on a flow to stop that flow. On an appointment of that type, **Send** under **Reminders** and **Forms** is disabled, and the tooltip reads "Patient communications are turned off for this appointment type."

Where to find it: **Preferences → Appointment Types**.

### Provider adjustment type
_Rolls out with next release · Billers_

You can move a provider adjustment between **Athelas** and **Non-Athelas** when the automatic classification is wrong. **Change type**, in the Actions column on the **Provider Adjustments** tab, asks you to confirm the amount, the reason code, and the type you are switching to. A posted adjustment counts toward the new type's total on the check as soon as you confirm. An adjustment that is pending or in manual review counts toward the new type's total once you post the adjustment. Archived rows do not offer **Change type**.

Where to find it: **Insights → Daily Operations → Remittances → Checks → open a check → Provider Adjustments**.

[IMG 4]

[IMG 5]

### Cases and appointments on a prior authorization
_Rolls out with next release · Front desk, Billers_

The properties rail on a prior authorization now includes **Cases**, after Patient Demographics. **Episodes of Care** moves into **Cases**, and Patient Demographics keeps General, Contact, and Insurance. **Cases** has **Active**, **Discharged**, and **Hospice** tabs, a **New Case** button with **New Hospice Case**, and the same row actions as Episodes of Care on the patient chart.

**Appointments** adds **Add appointment** and a per-row **Edit appointment**. Both open the appointment drawers used on the schedule. A **Prior Authorization** column after Insurance lists the primary, secondary, and tertiary authorizations on the visit, and each number opens the matching authorization when you have access to prior authorizations. The placeholder **Send** button is removed.

Where to find it: open a prior authorization, then **Cases** or **Appointments** in the properties rail.

### Frontdesk inbox updates
_Rolls out with next release · Admins, Front desk_

**Enable Frontdesk Inbox Updates** turns check-in review on or off for your practice. While the setting is on, Air sends a patient or insurance update at check-in for review only when the submission includes a change. Submitting unchanged information does not show a submitted-for-review message, because no review was created. While the setting is off, check-in saves patient and insurance updates directly.

Where to find it: the **General** tab in preferences.

### Saved dashboard names
_Rolls out with next release · Admins, Billers_

Saved dashboards can be renamed from the gallery. In the card menu, beside **Duplicate** and **Delete**, choose **Rename**. The title becomes a text field. Press Enter, or click away, to save. Press Escape to cancel. A blank name is not saved. **Rename** appears on a saved dashboard and does not appear on a template. The new name shows right away. If the save does not succeed, the card returns to the previous name. The field accepts up to 255 characters.

Where to find it: **Dashboards**, on a saved dashboard card.

## Changed

### Bad debt charge pause
_Rolls out with next release · Billers_

**Pause** and **Resume** are removed from a bad debt charge, in the row menu and in bulk actions. Bad debt still pauses from the practice-wide workflow control, and bad debt already follows that control.

### Practice Data access
_Rolls out with next release · Admins_

**Practice Data** in the side navigation now lists the tables the signed-in account can read. **Add** is enabled when that account can edit the table, and **Add** stays disabled, with the same tooltip as before, when the account cannot edit. **Import** is enabled only when the account has import permission. Until that permission is provided, **Import** stays off, including for accounts that could import before.

Opening **Practice Data** lands on the first table the account can read. If the account cannot read any table, the page says "You don't have access to any data tables." and shows no links. A link straight to a table the account cannot read shows the table as unavailable. A table outside the usual groups appears under **Other**, with the table's name.

Where to find it: **Practice Data**.

### Data table CSV download
_Rolls out with next release · Admins_

A data table download used to ask whether the file should contain every row or only the filtered rows. The download now starts as soon as you click, and the file contains only the rows that match the filters on the table. Clear the filters, or the saved view, first when you need every row.

### Time in Status on claims
_Rolls out with next release · Billers_

**Time in Status** is now included on the default claims views: **All Claims**, **Workable Claims**, **My Claims**, and the claims tab on a patient. The column used to stay hidden until you turned the column on in **Display**. A saved view keeps the columns that view already had, so a view that never included **Time in Status** still hides the column. Display choices saved in the browser during the last day can also keep the column hidden until those choices expire or you reset **Display**.

### Summaries on finalized claims
_Rolls out with next release · Billers_

A claim shown as **Finalized**, with nothing left in another work queue, keeps the summary already on the claim. The summary still shows, including a summary that is out of date. **Regenerate**, **Try again**, and **Generate summary** are not offered. When no summary exists, the card reads "No summary has been generated for this claim yet." The banner that asked for a refresh of an out-of-date summary is hidden. **Suggested Actions** still appear in the card.

A claim that still has work in a queue, such as Payment Posting, keeps the usual summary controls, including **Regenerate**, even when the claim's stage is finalized.

### Room on the appointment card
_Rolls out with next release · Front desk, Providers_

The room on an appointment card now sits beside the appointment status, on the calendar and on Provider Home. The room used to follow the case and the visit type, where a long room name was cut off. A dot separates the status and the room when both appear. Compact cards still show the room. A long room name shortens on the card. Hover the room name to see the full name. A view that hides room names still hides them.

### Write-off approval label
_Rolls out with next release · Billers_

The Write-off Approval column, and the matching filter, now say **Approval pending**. The previous label was **Awaiting approval**, which read as if the approval were already late.

### Bad debt charge scope
_Rolls out with next release · Billers_

The bad debt configuration now states which charges the notices pick up: post-visit charges once the encounter has reached the patient, and miscellaneous charges billed straight to the patient. That scope is in the header tooltip and at the start of the creation form.

**Lists other balances** now spells out both settings. Off, the write-off stays on the single charge. On, the write-off covers the whole notice: post-visit charges that have reached the patient, and miscellaneous charges billed to the patient. Balances still with insurance stay off the notice. Approval is still decided per charge.

### Rule builder layout
_Beta customers · Admins_

In the rule builder, the list of rules on the left can collapse so the editor uses the full width. The list opens expanded on each visit. Each collapsed rule is an icon. Selecting an icon switches to that rule and leaves the list collapsed. A rule with an error shows a dot on the icon. **Delete rule** is in the **Rule actions** menu, under the **…** button.

Where to find it: **Automations → Rules**, in the rule builder.

## Fixed

- **Manual posting** — A second click on **Post**, **Confirm**, or **Confirm Posting** while the first request is still sending no longer creates a duplicate payment item, and a failed attempt can still be retried.
- **Claim details** — Opening a claim from the claims list no longer counts as an unsaved edit when you have not changed the claim, and the browser Back button returns to the list.
- **Scheduling Templates** — Applied templates that start within the next six months now appear under **Upcoming**.
- **Air Scribe** — When a recording cannot start, the message names the cause: microphone access is blocked, no microphone was found, or the microphone is in use by another app, along with what to do next.
- **Prescriber agents** — The prescriber agent details under **Preferences → Medications → Prescriber Agents** no longer crash while a sync is saving.
- **Appointments filters** — The **f** shortcut on the Appointments page no longer takes down the filter bar when the browser sends a keystroke with no key, which can happen during autofill.
- **Dashboard charts** — Stacked charts in the same row now share one height, so the axes line up when one legend wraps onto more lines than another.

</Update>
