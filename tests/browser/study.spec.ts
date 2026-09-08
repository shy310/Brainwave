import { test, expect } from "@playwright/test";

const source =
  "Photosynthesis uses sunlight, water, and carbon dioxide to make glucose and oxygen. Chlorophyll absorbs sunlight in leaves.";
const fixture = {
  title: "Photosynthesis, one step at a time",
  subject: "SCIENCE",
  notes: `Plants use sunlight to turn water and carbon dioxide into glucose and oxygen. [Page 1]\n\nExample: a leaf uses chlorophyll to absorb sunlight.`,
  cards: Array.from({ length: 4 }, (_, i) => ({
    front: [
      "What powers photosynthesis?",
      "What absorbs sunlight?",
      "What gas do plants use?",
      "What do plants make?",
    ][i],
    back: ["Sunlight", "Chlorophyll", "Carbon dioxide", "Glucose and oxygen"][
      i
    ],
    pages: [1],
  })),
  questions: Array.from({ length: 8 }, (_, i) => ({
    questionType: "MULTIPLE_CHOICE",
    question: `In example ${i + 1}, which input supplies energy for photosynthesis?`,
    options: [
      { id: "a", text: "Sunlight" },
      { id: "b", text: "Soil" },
      { id: "c", text: "Oxygen" },
    ],
    correctOptionId: "a",
    skillTag: "photosynthesis",
    difficulty: 1,
    hint: "Think about what a leaf absorbs during daylight.",
    explanation:
      "Sunlight provides the energy. Chlorophyll in the leaf absorbs it.",
    sourcePages: [1],
  })),
};

async function setup(page: any, language = "en") {
  // Keep functional tests independent of third-party font availability.
  // Real-font screenshots are checked separately in the browser.
  await page.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, (route: any) => route.abort());
  await page.addInitScript(
    ({ language }: { language: string }) => {
      if (localStorage.getItem("browser-test-initialized")) return;
      const user = {
        id: "learner",
        username: "learner",
        name: "Alex",
        gradeLevel: "GRADE_9",
        preferredLanguage: language,
        enrolledCourses: [],
        totalXp: 0,
        streakDays: 0,
        isRegistered: true,
        progressMap: {},
        skillMap: {},
      };
      localStorage.setItem(
        "brainwave_users_db",
        JSON.stringify({ learner: user }),
      );
      localStorage.setItem(
        "brainwave_session_v2",
        JSON.stringify({
          isLoggedIn: true,
          lastUserId: "learner",
          language,
          theme: "light",
        }),
      );
      localStorage.setItem("browser-test-initialized", "1");
    },
    { language },
  );
  await page.route("**/api/**", async (route: any) => {
    const request = route.request();
    if (request.url().includes("/api/claude")) {
      const body = request.postDataJSON();
      const content = body.system?.includes(
        "create accurate learning activities",
      )
        ? JSON.stringify(fixture)
        : body.system?.includes("Transcribe only")
          ? source
          : body.system?.includes("careful, age-appropriate")
            ? JSON.stringify({
                correct: true,
                feedback:
                  "You connected sunlight to energy. Next, explain the role of chlorophyll.",
              })
            : "Try connecting sunlight to the energy the plant needs.";
      await route.fulfill({
        json: { content: [{ type: "text", text: content }] },
      });
    } else await route.fulfill({ json: { success: true } });
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });
}

test("material draft survives close and refresh, then clears after success", async ({page}) => {
  await setup(page);
  const open = () => page.getByRole('button', {name:'Add study material',exact:true}).first().click();
  await open();
  await page.getByRole('button', {name:'Text',exact:true}).click();
  await page.getByLabel('Title', {exact:true}).fill('My saved lesson');
  await page.getByLabel('Paste the actual content.', {exact:false}).fill(source);
  await page.getByRole('button', {name:'Cancel',exact:true}).click();
  await page.reload();
  await open();
  await expect(page.getByLabel('Title', {exact:true})).toHaveValue('My saved lesson');
  await expect(page.getByLabel('Paste the actual content.', {exact:false})).toHaveValue(source);
  await page.getByRole('button', {name:'Create study set',exact:true}).click();
  await expect(page.getByRole('heading', {name:fixture.title})).toBeVisible();
  await page.getByRole('button', {name:'Back',exact:true}).click();
  await open();
  await expect(page.getByLabel('What are we learning?', {exact:true})).toHaveValue('');
});

test("blocked draft storage warns without losing text", async ({page}) => {
  await setup(page);
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if (key.startsWith('brainwave-material-draft-v1:')) throw new DOMException('Full','QuotaExceededError');
      return original.call(this,key,value);
    };
  });
  await page.getByRole('button',{name:'Add study material',exact:true}).first().click();
  await page.getByLabel('What are we learning?',{exact:true}).fill('Keep this topic');
  await expect(page.getByRole('alert')).toContainText('Draft autosave is unavailable');
  await expect(page.getByLabel('What are we learning?',{exact:true})).toHaveValue('Keep this topic');
});

test("provider credit failures explain the issue and retain the topic", async ({page}) => {
  await setup(page);
  await page.route('**/api/claude', route => route.fulfill({status:402,json:{error:'Insufficient credits'}}));
  await page.getByRole('button', {name:'Add study material',exact:true}).first().click();
  await page.getByLabel('What are we learning?', {exact:true}).fill('חיבור וחיסור חזקות');
  await page.getByRole('button', {name:'Create study set',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('insufficient credits');
  await expect(page.getByLabel('What are we learning?', {exact:true})).toHaveValue('חיבור וחיסור חזקות');
});

test("Hebrew math topic accepts numeric questions without choice arrays", async ({ page }) => {
  await setup(page);
  let requests = 0;
  await page.route("**/api/claude", route => { requests++; return route.fulfill({ json: { content: [{ type: "text", text: JSON.stringify({
    ...fixture,
    cards: fixture.cards.map(({pages, ...card}) => card),
    title: "חיבור וחיסור חזקות",
    subject: "MATH",
    questions: Array.from({ length: 8 }, (_, i) => ({
      questionType: "NUMERIC", question: `What is ${i + 2} squared?`,
      sampleAnswer: String((i + 2) ** 2), skillTag: "powers",
      hint: "Multiply the base by itself.", explanation: "Squaring multiplies a number by itself.",
    })),
  }) }] } }); });
  await page.getByRole("button", { name: "Add study material", exact: true }).first().click();
  await page.getByLabel("What are we learning?", { exact: true }).fill("חיבור וחיסור חזקות");
  await page.getByRole("button", { name: "Create study set", exact: true }).click();
  await expect(page.getByRole("heading", { name: "חיבור וחיסור חזקות", exact: true })).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect(requests).toBe(1);
});

test("material → notes → sprint → help → recap → progress → restore", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await setup(page);
  await expect(
    page.getByRole("heading", { name: "A little curiosity. A big next step." }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Add study material", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "Text", exact: true }).click();
  await page.getByLabel("Title", { exact: true }).fill("Photosynthesis");
  await page
    .getByLabel("Paste the actual content.", { exact: false })
    .fill(source);
  await page
    .getByRole("button", { name: "Create study set", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: fixture.title }),
  ).toBeVisible();
  await expect(page.getByLabel("Notes", { exact: true })).toHaveValue(
    fixture.notes,
  );
  await page
    .getByRole("button", { name: "Your study partner", exact: true })
    .click();
  await page
    .getByLabel("Ask about this step…")
    .fill("Why does the plant need sunlight?");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByRole("log")).toContainText("Try connecting sunlight");
  await page.getByRole("button", { name: "Back", exact: true }).last().click();
  await page.getByRole("button", { name: "5 min", exact: true }).click();
  await page.getByRole("button", { name: "Let’s learn", exact: true }).click();
  await page.getByRole("button", { name: "A Sunlight", exact: true }).click();
  await page.getByRole("button", { name: "Check answer", exact: true }).click();
  await expect(page.getByText("You’ve got it!", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Save & leave" }).click();
  await page.reload();
  await page
    .getByRole("button", { name: "Continue your sprint", exact: false })
    .click();
  await expect(page.getByText("You’ve got it!", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Next step" }).click();
  await expect(
    page.getByRole("heading", { name: "Make it click" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Next step" }).click();
  await page.getByRole("button", { name: "A little hint" }).click();
  await page.getByRole("button", { name: "A Sunlight", exact: true }).click();
  await page.getByRole("button", { name: "Check answer", exact: true }).click();
  await page.getByRole("button", { name: "Next step" }).click();
  await page.getByRole("button", { name: "A Sunlight", exact: true }).click();
  await page.getByRole("button", { name: "Check answer", exact: true }).click();
  await page.getByRole("button", { name: "Next step" }).click();
  await page
    .getByLabel("Your answer", { exact: true })
    .fill(
      "A plant uses sunlight to make glucose. Chlorophyll absorbs light in the leaves.",
    );
  await page.getByRole("button", { name: "Check answer", exact: true }).click();
  await expect(
    page.getByText("You connected sunlight", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "See my recap" }).click();
  await expect(
    page.getByRole("heading", { name: "Look what you did." }),
  ).toBeVisible();
  await expect(
    page.getByText("Solved independently", { exact: true }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("brainwave_users_db")!).learner
            .studyResultIds?.length,
      ),
    )
    .toBe(4);
  const xp = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("brainwave_users_db")!).learner.totalXp,
  );
  await page.reload();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("brainwave_users_db")!).learner
            .totalXp,
      ),
    )
    .toBe(xp);
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Progress", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Mastery Map", exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

for (const language of ["en", "he", "ar", "ru"])
  test(`phone layout and navigation: ${language}`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await setup(page, language);
    await expect(page.locator(".bw-hero")).toBeVisible();
    await expect(page.locator(".bw-main-nav button")).toHaveCount(4);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.locator(".bw-main-nav button").nth(2).click();
    await expect(page.locator(".bw-practice-start")).toBeVisible();
    await page.locator(".bw-header-actions>.bw-icon-button").click();
    await expect(page.locator("html")).toHaveClass(/dark/);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  });

test("source failures preserve input and URLs do not masquerade as transcripts", async ({
  page,
}) => {
  await setup(page);
  await page
    .getByRole("button", { name: "Add study material", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "Transcript", exact: true }).click();
  await page.getByLabel("Title", { exact: true }).fill("Video");
  await page
    .getByLabel("Paste the actual content.", { exact: false })
    .fill("https://youtube.com/watch?v=not-a-transcript");
  await page.getByRole("button", { name: "Create study set" }).click();
  await expect(page.getByRole("alert")).toContainText("Links alone");
  await page
    .getByLabel("Paste the actual content.", { exact: false })
    .fill(source);
  await page.route("**/api/claude", (route) =>
    route.fulfill({ status: 503, json: { error: "Unavailable" } }),
  );
  await page.getByRole("button", { name: "Create study set" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Your input is still here",
  );
  await expect(
    page.getByLabel("Paste the actual content.", { exact: false }),
  ).toHaveValue(source);
});

function textPdf() {
  const stream = `BT /F1 12 Tf 40 750 Td (${source}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 1200 800] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((o, i) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((o) => String(o).padStart(10, "0") + " 00000 n ")
    .join(
      "\n",
    )}\ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf);
}
for (const kind of ["pdf", "photo"])
  test(`${kind} import requires reviewed extraction`, async ({ page }) => {
    await setup(page);
    await page
      .getByRole("button", { name: "Add study material", exact: true })
      .first()
      .click();
    await page
      .getByRole("button", { name: "PDF or photo", exact: true })
      .click();
    await page
      .locator("input[type=file]")
      .setInputFiles(
        kind === "pdf"
          ? {
              name: "lesson.pdf",
              mimeType: "application/pdf",
              buffer: textPdf(),
            }
          : {
              name: "lesson.png",
              mimeType: "image/png",
              buffer: Buffer.from(
                "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jB1sAAAAASUVORK5CYII=",
                "base64",
              ),
            },
      );
    await page
      .getByRole("button", { name: "Read material", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Check the extracted text" }),
    ).toBeVisible();
    await expect(
      page.getByRole("textbox", { name: "Page 1", exact: true }),
    ).toContainText("Photosynthesis");
    await expect(
      page.getByRole("button", { name: "Create study set" }),
    ).toBeDisabled();
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Create study set" }).click();
    await expect(
      page.getByRole("heading", { name: fixture.title }),
    ).toBeVisible();
  });

test("failed device save is recoverable without discarding the generated set", async ({
  page,
}) => {
  await setup(page);
  await page
    .getByRole("button", { name: "Add study material", exact: true })
    .first()
    .click();
  await page
    .getByLabel("What are we learning?", { exact: true })
    .fill("Photosynthesis");
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    let once = true;
    IDBObjectStore.prototype.put = function (...args: any[]) {
      if (once) {
        once = false;
        throw new DOMException("Full", "QuotaExceededError");
      }
      return original.apply(this, args as any);
    };
  });
  await page.getByRole("button", { name: "Create study set" }).click();
  await expect(
    page.getByRole("heading", { name: fixture.title }),
  ).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("Could not save");
  await page.getByRole("button", { name: "Retry saving" }).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: fixture.title, level: 3 }),
  ).toBeVisible();
});
