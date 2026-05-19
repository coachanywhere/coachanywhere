// CoachAnywhere — Insert Dummy Coaches Script (Fixed with Avatar URLs)
// Paste into Airtable Scripting extension and click Run

const table = base.getTable("Coaches");

const dummyCoaches = [
  {
    "First Name": "Jordan",
    "Last Name": "Parke",
    "Email": "jordan.parke@example.com",
    "Mobile": "0412 111 222",
    "Sport(s) Coached": "Basketball",
    "Location": "Melbourne, VIC",
    "Bio": "Fourteen years on the court - six as a player, eight as a coach - taught me that the difference between good and elite is in the details most people miss. I've worked with state-level programs and NBL academy squads, breaking down film and building players from the ground up. My sessions are technical, honest and results-driven. If you're serious about improving your game, upload your first clip and let's find what's holding you back.",
    "Coaching Style": "Technical, Analytical, Video Analysis Focused",
    "Qualifications": "Level 2 Basketball Australia Accredited Coach, NBL Academy Coach 2019-2022, Bachelor of Sports Science (Deakin University)",
    "Headshot URL": "https://i.pravatar.cc/400?u=jordan.parke@example.com",
    "Selected Tier": "Level 2 - Performance Coach",
    "Billing Cycle": "Monthly",
    "Foundation Member": true,
    "Monthly Rate": 79,
    "Foundation Rate": 79,
    "Platform Commission": "20%",
    "Profile Status": "Live",
    "Turnaround Time": "48 hours",
    "AI Recommended Tier": "Level 2 - Performance Coach",
    "AI Confidence": "88%",
    "Coach Agreed with AI": "Agreed",
    "Status": "Active"
  },
  {
    "First Name": "Emily",
    "Last Name": "Collins",
    "Email": "emily.collins@example.com",
    "Mobile": "0423 333 444",
    "Sport(s) Coached": "AFL",
    "Location": "Adelaide, SA",
    "Bio": "Growing up playing SANFL taught me what it takes to compete at a high level - and coaching has shown me how to pass that on. I specialise in working with junior and developing AFL players on the fundamentals that actually matter: kicking mechanics, reading the play and contested ball. My feedback is direct, practical and backed by game footage analysis. Let's work on your game together.",
    "Coaching Style": "Fundamentals First, Player Development, Motivational",
    "Qualifications": "AFL Level 1 Accredited Coach, SANFL Women's Representative Coach, Certificate IV in Sport Coaching",
    "Headshot URL": "https://i.pravatar.cc/400?u=emily.collins@example.com",
    "Selected Tier": "Level 1 - Development Coach",
    "Billing Cycle": "Monthly",
    "Foundation Member": true,
    "Monthly Rate": 39,
    "Foundation Rate": 39,
    "Platform Commission": "20%",
    "Profile Status": "Live",
    "Turnaround Time": "48 hours",
    "AI Recommended Tier": "Level 1 - Development Coach",
    "AI Confidence": "82%",
    "Coach Agreed with AI": "Agreed",
    "Status": "Active"
  },
  {
    "First Name": "Marcus",
    "Last Name": "Reid",
    "Email": "marcus.reid@example.com",
    "Mobile": "0434 555 666",
    "Sport(s) Coached": "Soccer",
    "Location": "Sydney, NSW",
    "Bio": "Ten years coaching at national pathway and A-League academy level gave me a deep understanding of what separates technically gifted players from those who actually make it. I work with players on first touch, positioning, decision-making under pressure and match intelligence. Every clip I review gets a full written breakdown with specific drills you can do at your next training session.",
    "Coaching Style": "Tactical, High Performance, Analytical",
    "Qualifications": "AFC B Licence, A-League Academy Head Coach 2017-2022, FFA National Coaching Director Certificate",
    "Headshot URL": "https://i.pravatar.cc/400?u=marcus.reid@example.com",
    "Selected Tier": "Level 3 - Elite Coach",
    "Billing Cycle": "Monthly",
    "Foundation Member": true,
    "Monthly Rate": 159,
    "Foundation Rate": 159,
    "Platform Commission": "20%",
    "Profile Status": "Live",
    "Turnaround Time": "48 hours",
    "AI Recommended Tier": "Level 3 - Elite Coach",
    "AI Confidence": "91%",
    "Coach Agreed with AI": "Agreed",
    "Status": "Active",
    "Spotlight": true
  },
  {
    "First Name": "Sarah",
    "Last Name": "Nguyen",
    "Email": "sarah.nguyen@example.com",
    "Mobile": "0445 777 888",
    "Sport(s) Coached": "Tennis",
    "Location": "Brisbane, QLD",
    "Bio": "From junior club player to state-ranked coach - tennis has been my whole life. I work with players at every level, from beginners fixing their serve to competitive juniors preparing for state tournaments. My coaching style is technical and patient: I break down every stroke frame by frame, find the root cause of the issue and give you a clear path to fix it.",
    "Coaching Style": "Technical, Communication Focused, Athlete-Centred",
    "Qualifications": "Tennis Australia Level 2 Coach, Queensland State Junior Program Coach, High Performance Coaching Certificate",
    "Headshot URL": "https://i.pravatar.cc/400?u=sarah.nguyen@example.com",
    "Selected Tier": "Level 2 - Performance Coach",
    "Billing Cycle": "Fortnightly",
    "Foundation Member": true,
    "Monthly Rate": 79,
    "Foundation Rate": 79,
    "Platform Commission": "20%",
    "Profile Status": "Live",
    "Turnaround Time": "48 hours",
    "AI Recommended Tier": "Level 2 - Performance Coach",
    "AI Confidence": "85%",
    "Coach Agreed with AI": "Agreed",
    "Status": "Active"
  },
  {
    "First Name": "Daniel",
    "Last Name": "Walsh",
    "Email": "daniel.walsh@example.com",
    "Mobile": "0456 999 000",
    "Sport(s) Coached": "Basketball",
    "Location": "Perth, WA",
    "Bio": "After a decade playing and coaching at semi-professional level in the NBL1, I know what it takes to compete at the highest levels of Australian basketball. I specialise in guard development - ball handling, shooting off the dribble, pick and roll reads and defensive positioning. My reviews are detailed, video-driven and always focused on what you can actually do differently at your next training session.",
    "Coaching Style": "High Performance, Technical, Tactical",
    "Qualifications": "Basketball Australia Level 3 Coach, NBL1 West Assistant Coach, Graduate Diploma Sports Coaching (ECU)",
    "Headshot URL": "https://i.pravatar.cc/400?u=daniel.walsh@example.com",
    "Selected Tier": "Level 3 - Elite Coach",
    "Billing Cycle": "Monthly",
    "Foundation Member": true,
    "Monthly Rate": 159,
    "Foundation Rate": 159,
    "Platform Commission": "20%",
    "Profile Status": "Live",
    "Turnaround Time": "48 hours",
    "AI Recommended Tier": "Level 3 - Elite Coach",
    "AI Confidence": "89%",
    "Coach Agreed with AI": "Agreed",
    "Status": "Active",
    "Spotlight": true
  },
  {
    "First Name": "Priya",
    "Last Name": "Sharma",
    "Email": "priya.sharma@example.com",
    "Mobile": "0467 111 333",
    "Sport(s) Coached": "Netball",
    "Location": "Melbourne, VIC",
    "Bio": "Netball is a game of precision, timing and smart movement - and those are exactly the things I coach. Coming from a representative playing background and now coaching junior and senior club teams, I understand what athletes need to hear to actually improve. My feedback is always specific, always actionable and always honest.",
    "Coaching Style": "Player Development, Fundamentals First, Junior Development",
    "Qualifications": "Netball Australia Level 1 Coach, Victorian Representative Program, Certificate III in Fitness",
    "Headshot URL": "https://i.pravatar.cc/400?u=priya.sharma@example.com",
    "Selected Tier": "Level 1 - Development Coach",
    "Billing Cycle": "Monthly",
    "Foundation Member": true,
    "Monthly Rate": 39,
    "Foundation Rate": 39,
    "Platform Commission": "20%",
    "Profile Status": "Live",
    "Turnaround Time": "48 hours",
    "AI Recommended Tier": "Level 1 - Development Coach",
    "AI Confidence": "80%",
    "Coach Agreed with AI": "Agreed",
    "Status": "Active"
  },
  {
    "First Name": "Tom",
    "Last Name": "Henderson",
    "Email": "tom.henderson@example.com",
    "Mobile": "0478 222 444",
    "Sport(s) Coached": "Cricket",
    "Location": "Brisbane, QLD",
    "Bio": "Eight years coaching cricket at state and district level has given me an eye for the details that make the difference - grip pressure, bowling seam position, batting trigger movements, field reading. Whether you're a batter wanting to fix a technical flaw or a bowler looking to add consistency, I break it down clearly and give you specific things to work on.",
    "Coaching Style": "Technical, Analytical, Video Analysis Focused",
    "Qualifications": "Cricket Australia Level 2 Coach, Queensland State U19 Program, Bachelor of Exercise Science (QUT)",
    "Headshot URL": "https://i.pravatar.cc/400?u=tom.henderson@example.com",
    "Selected Tier": "Level 2 - Performance Coach",
    "Billing Cycle": "Monthly",
    "Foundation Member": true,
    "Monthly Rate": 79,
    "Foundation Rate": 79,
    "Platform Commission": "20%",
    "Profile Status": "Live",
    "Turnaround Time": "48 hours",
    "AI Recommended Tier": "Level 2 - Performance Coach",
    "AI Confidence": "86%",
    "Coach Agreed with AI": "Agreed",
    "Status": "Active"
  },
  {
    "First Name": "Aiden",
    "Last Name": "Brooks",
    "Email": "aiden.brooks@example.com",
    "Mobile": "0489 555 777",
    "Sport(s) Coached": "AFL",
    "Location": "Melbourne, VIC",
    "Bio": "A decade coaching at VFL and state pathway level has taught me that most players plateau not because of talent, but because of small technical habits that nobody has ever corrected. I review game footage and training clips with a sharp eye for the things that actually drive improvement - kicking efficiency, contested positioning, running patterns and decision-making.",
    "Coaching Style": "High Performance, Tactical, Video Analysis Focused",
    "Qualifications": "AFL Level 2 Coach, VFL Club Assistant Coach, Sports Science Diploma (VU)",
    "Headshot URL": "https://i.pravatar.cc/400?u=aiden.brooks@example.com",
    "Selected Tier": "Level 3 - Elite Coach",
    "Billing Cycle": "Monthly",
    "Foundation Member": true,
    "Monthly Rate": 159,
    "Foundation Rate": 159,
    "Platform Commission": "20%",
    "Profile Status": "Live",
    "Turnaround Time": "48 hours",
    "AI Recommended Tier": "Level 3 - Elite Coach",
    "AI Confidence": "90%",
    "Coach Agreed with AI": "Agreed",
    "Status": "Active"
  }
];

// Delete existing dummy records first
output.text("Cleaning up existing dummy coaches...");
const existing = await table.selectRecordsAsync();
const dummyEmails = dummyCoaches.map(c => c["Email"]);
const toDelete = existing.records
  .filter(r => dummyEmails.includes(r.getCellValueAsString("Email")))
  .map(r => r.id);

if (toDelete.length > 0) {
  // Delete in batches of 50
  for (let i = 0; i < toDelete.length; i += 50) {
    await table.deleteRecordsAsync(toDelete.slice(i, i + 50));
  }
  output.text("Deleted " + toDelete.length + " existing dummy records.");
}

output.text("Inserting " + dummyCoaches.length + " coaches with avatars...");
let inserted = 0;
for (const coach of dummyCoaches) {
  try {
    await table.createRecordAsync(coach);
    output.text("OK " + coach["First Name"] + " " + coach["Last Name"] + " - " + coach["Sport(s) Coached"]);
    inserted++;
  } catch(e) {
    output.text("FAILED " + coach["First Name"] + " " + coach["Last Name"] + " - " + e.message);
  }
}
output.text("\nDone! " + inserted + " coaches added.");
