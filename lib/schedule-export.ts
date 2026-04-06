/**
 * Microsoft Project XML (MSP2003+) — opens directly in MS Project via File → Open.
 * Primavera P6 imports the same file via File → Import → Microsoft Project (XML).
 */

export type ScheduleItem = {
  id?: number | string;
  wbs?: string;
  name?: string;
  phase?: string;
  durationDays?: number;
  startOffsetDays?: number;
  dependencies?: Array<number | string>;
};

type PlanPayload = Record<string, unknown>;

function xmlEscape(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** MS Project XML dateTime (local, no Z). */
function toXmlDateTime(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

function toDateOnly(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function outlineLevelFromWbs(wbs: string): number {
  const parts = wbs.split(/[./]/).filter(Boolean);
  return Math.max(1, parts.length);
}

function getScheduleArray(plan: PlanPayload): ScheduleItem[] {
  const raw = plan["schedule"];
  return Array.isArray(raw) ? (raw as ScheduleItem[]) : [];
}

/** ISO-8601 duration: working hours = durationDays × 8h/day. */
function durationPtHours(totalHours: number): string {
  const h = Math.max(0, Math.round(totalHours));
  return `PT${h}H0M0S`;
}

function standardCalendarXml(): string {
  // DayType 1=Sun … 7=Sat; working Mon–Fri 8–12, 13–17
  const working = `
      <WorkingTimes>
        <WorkingTime><FromTime>08:00:00</FromTime><ToTime>12:00:00</ToTime></WorkingTime>
        <WorkingTime><FromTime>13:00:00</FromTime><ToTime>17:00:00</ToTime></WorkingTime>
      </WorkingTimes>`;
  return `
  <Calendars>
    <Calendar>
      <UID>1</UID>
      <Name>Standard</Name>
      <IsBaseCalendar>1</IsBaseCalendar>
      <BaseCalendarUID>-1</BaseCalendarUID>
      <WeekDays>
        <WeekDay><DayType>1</DayType><DayWorking>0</DayWorking></WeekDay>
        <WeekDay><DayType>2</DayType><DayWorking>1</DayWorking>${working}</WeekDay>
        <WeekDay><DayType>3</DayType><DayWorking>1</DayWorking>${working}</WeekDay>
        <WeekDay><DayType>4</DayType><DayWorking>1</DayWorking>${working}</WeekDay>
        <WeekDay><DayType>5</DayType><DayWorking>1</DayWorking>${working}</WeekDay>
        <WeekDay><DayType>6</DayType><DayWorking>1</DayWorking>${working}</WeekDay>
        <WeekDay><DayType>7</DayType><DayWorking>0</DayWorking></WeekDay>
      </WeekDays>
    </Calendar>
  </Calendars>`;
}

/**
 * Build Microsoft Project XML. Same document is valid for Primavera P6 “Microsoft Project (XML)” import.
 */
export function buildMicrosoftProjectXml(
  plan: PlanPayload,
  options?: { projectStartDate?: string; projectName?: string }
): string {
  const items = getScheduleArray(plan);
  const projectTitle =
    (options?.projectName && String(options.projectName).trim()) ||
    (typeof plan["projectName"] === "string" && String(plan["projectName"]).trim()) ||
    "Imported schedule";

  const start = options?.projectStartDate ? new Date(options.projectStartDate) : new Date();
  if (Number.isNaN(start.getTime())) {
    throw new Error("Invalid project start date");
  }

  const now = new Date();
  const startDateStr = toXmlDateTime(start);
  const idToUid = new Map<string, number>();
  items.forEach((item, index) => {
    const key = item.id != null && String(item.id).length > 0 ? String(item.id) : String(index + 1);
    idToUid.set(key, index + 1);
  });

  const taskBlocks: string[] = [];
  let projectFinish = start.getTime();

  // Summary / root task (helps Project group the program)
  taskBlocks.push(`
    <Task>
      <UID>0</UID>
      <ID>0</ID>
      <Name>${xmlEscape(projectTitle)}</Name>
      <Type>1</Type>
      <IsNull>0</IsNull>
      <WBS>0</WBS>
      <OutlineLevel>0</OutlineLevel>
      <OutlineNumber>0</OutlineNumber>
      <Priority>500</Priority>
      <Start>${startDateStr}</Start>
      <Finish>${startDateStr}</Finish>
      <Manual>0</Manual>
      <Duration>PT0H0M0S</Duration>
      <DurationFormat>21</DurationFormat>
      <CalendarUID>1</CalendarUID>
    </Task>`);

  let lineId = 1;
  for (let index = 0; index < items.length; index++) {
    const item = items[index];
    const idKey = item.id != null && String(item.id).length > 0 ? String(item.id) : String(index + 1);
    const uid = idToUid.get(idKey) ?? lineId;
    const baseName = (item.name ?? `Task ${lineId}`).toString();
    const displayName = item.phase ? `${baseName} [${item.phase}]` : baseName;
    const wbs = (item.wbs ?? String(lineId)).toString();
    const durationDays = Number.isFinite(item.durationDays ?? NaN) ? Math.max(0, Number(item.durationDays)) : 1;
    const offset = Number.isFinite(item.startOffsetDays ?? NaN) ? Number(item.startOffsetDays) : 0;

    const tStart = new Date(start.getTime());
    tStart.setDate(tStart.getDate() + offset);
    const tFinish = new Date(tStart.getTime());
    if (durationDays > 0) {
      tFinish.setDate(tFinish.getDate() + durationDays);
    }
    projectFinish = Math.max(projectFinish, tFinish.getTime());

    const hours = durationDays * 8;
    const predLinks: string[] = [];
    if (Array.isArray(item.dependencies)) {
      for (const pred of item.dependencies) {
        const pUid = idToUid.get(String(pred));
        if (pUid != null && pUid !== uid) {
          predLinks.push(`
      <PredecessorLink>
        <PredecessorUID>${pUid}</PredecessorUID>
        <Type>1</Type>
        <CrossProject>0</CrossProject>
        <LinkLag>0</LinkLag>
        <LagFormat>7</LagFormat>
      </PredecessorLink>`);
        }
      }
    }

    const noteParts = [
      item.phase ? `Phase: ${item.phase}` : "",
      typeof plan["constructionSchedule"] === "string"
        ? String(plan["constructionSchedule"]).slice(0, 500)
        : "",
    ].filter(Boolean);
    const notesXml = noteParts.length > 0 ? `\n      <Notes>${xmlEscape(noteParts.join("\n"))}</Notes>` : "";

    taskBlocks.push(`
    <Task>
      <UID>${uid}</UID>
      <ID>${lineId}</ID>
      <Name>${xmlEscape(displayName)}</Name>
      <Type>0</Type>
      <IsNull>0</IsNull>
      <WBS>${xmlEscape(wbs)}</WBS>
      <OutlineLevel>${outlineLevelFromWbs(wbs)}</OutlineLevel>
      <OutlineNumber>${xmlEscape(wbs)}</OutlineNumber>
      <Priority>500</Priority>
      <Start>${toXmlDateTime(tStart)}</Start>
      <Finish>${toXmlDateTime(tFinish)}</Finish>
      <Manual>0</Manual>
      <Duration>${durationPtHours(hours)}</Duration>
      <DurationFormat>21</DurationFormat>
      <CalendarUID>1</CalendarUID>${notesXml}${predLinks.join("")}
    </Task>`);
    lineId++;
  }

  const finishDateStr = toXmlDateTime(new Date(projectFinish));

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Project xmlns="http://schemas.microsoft.com/project">
  <SaveVersion>14</SaveVersion>
  <Name>${xmlEscape(projectTitle)}</Name>
  <Title>${xmlEscape(projectTitle)}</Title>
  <CreationDate>${toXmlDateTime(now)}</CreationDate>
  <LastSaved>${toXmlDateTime(now)}</LastSaved>
  <ScheduleFromStart>1</ScheduleFromStart>
  <StartDate>${startDateStr}</StartDate>
  <FinishDate>${finishDateStr}</FinishDate>
  <FYStartDate>1</FYStartDate>
  <CriticalSlackLimit>0</CriticalSlackLimit>
  <CurrencyDigits>2</CurrencyDigits>
  <CurrencySymbol>$</CurrencySymbol>
  <CalendarUID>1</CalendarUID>
  <DefaultStartTime>08:00:00</DefaultStartTime>
  <DefaultFinishTime>17:00:00</DefaultFinishTime>
  <MinutesPerDay>480</MinutesPerDay>
  <MinutesPerWeek>2400</MinutesPerWeek>
  <DaysPerMonth>20</DaysPerMonth>
  <CurrentDate>${toDateOnly(now)}T08:00:00</CurrentDate>
  ${standardCalendarXml()}
  <Tasks>${taskBlocks.join("")}
  </Tasks>
</Project>`;
}
