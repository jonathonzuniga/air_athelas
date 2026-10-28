<Update label="October 28, 2026" tags={["Air"]}>

  ## New

  ### Bulk write-off actions
  _Rolls out with next release · Billers_

  The Bad Debt charges table lets you select charges and run actions on the selection. Where your practice approves write-offs before they post, those actions include **Approve write-off** and **Disapprove write-off**. You can review a set of charges without opening each one.

  ### Final notice dispatch estimate
  _Rolls out with next release · Billers_

  When a Bad Debt charge is still waiting on its final notice, the **Statements Sent** column shows when that notice will next be handed to the delivery provider. A charge that still owes its first letter shows a **Dispatch** tag with the date and time, and a notice only minutes away reads **Dispatching shortly**. If the last attempt failed, the failure details add a **Next dispatch** line under **Last tried** and **Failing since**. The time is that handoff, not the moment the letter reaches the patient.

  ### Contact name search paging
  _Rolls out with next release · Front desk, Providers_

  **Contact Name** on **Create Contact** stopped after the first batch of NPI registry matches. **Show more** loads the next batch in the same list, and you can reach **Show more** from the keyboard as well as the pointer. The list stays open while the next page loads, and a provider already on the list is not repeated.

  Where to find it: **Patient chart → Contact Book → Create Contact → Contact Name**.

  [IMG 35]

  [IMG 36]

  ### Drilldown column order
  _Rolls out with next release · Admins, Billers_

  Row drilldowns on **Dashboards**, such as visits, appointments, and leads, listed their columns in one fixed order. You can drag a column header so the fields you use sit next to each other. Each metric remembers that order in this browser.

  Where to find it: **Dashboards → open a metric tile → drag a column header**.

  ## Changed

  ### Appointment types with communications off
  _Rolls out with next release · Admins, Front desk_

  Appointment types set to **Don't send patient communications** could be added to a workflow even though those visits never receive a message. Patient workflows and outreach flows label those types **Patient communications off** and block a new selection, while a type already on the workflow can still be removed. A patient workflow lists the types that will not receive messages, including when the workflow applies to every appointment type. An outreach flow shows the same warning under **Filters** when the filter includes one of those types, and excluding them with **is none of** does not warn.

  Where to find it: **Automation → Patient Workflows** or **Automation → Outreach Flows**.

  ### Custom dashboard date range
  _Rolls out with next release · Admins, Billers_

  A custom **Date range** on **Dashboards** reloaded as soon as you picked a start date. The range saves only when both dates are in place: choosing a start date opens the end calendar on that month and leaves the current range alone, and choosing an end date saves the range and closes the filter. A start date that falls after the end already chosen shows **To date must be after from date** and keeps the saved range. A preset still applies as soon as you choose it, and the date menu on Appointments is unchanged.

  ### Metric definitions on hover
  _Rolls out with next release · Admins, Billers_

  The info icon on a **Dashboards** metric tile opened the definition only after a click. Resting on the icon opens the definition, including how the metric is calculated, and keyboard focus opens the definition immediately. The panel pauses briefly before opening and stays open while you move onto it, so a passing pointer does not flash the definition. Clicking the icon opens the drilldown, the same as clicking the rest of the tile.

  ### Kiosk check-in entry
  _Rolls out with next release · Patients, on the check-in kiosk_

  Enter on the check-in kiosk submitted the name form from **First Name** and did nothing on the patient and insurance forms, while the on-screen keyboard could cover **Continue**. The 5-digit verification code submits when the last digit is entered, and the date of birth continues once the date is complete. Enter moves from **First Name** to the next name field; Enter in **Address Line 1** submits the patient form, and Enter in **Policy Number** submits the insurance form. Choosing a state or an insurance company from the list does not submit.

  ### Record count on the view tab
  _Rolls out with next release · Admins_

  On **Provider Credentialing**, the filtered total appeared only as an **Entries** count in the header. The selected view tab shows that total beside its name, and the header count is gone. The number clears when you switch views or change a filter, then returns when the new total has loaded, so the tab does not keep the previous view's count.

  ## Fixed

  - **Bad Debt charge details** — Opening a charge from the Bad Debt table keeps the guarantor on the link, so a charge someone else guarantees shows that charge's balance instead of a self-pay page that says **No data found**.
  - **Checks side list** — On **Remittances**, the **Checks** list stays at the top after a search or filter when the selected check is not on the current page, instead of jumping to the bottom, and the deposit list does the same.

</Update>
