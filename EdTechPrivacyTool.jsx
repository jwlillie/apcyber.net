import { useState, useEffect, useCallback, useRef } from "react";

// ─── Storage Keys ────────────────────────────────────────────────────────────
const RESOURCES_KEY = "edtech-resources-v3";
const ANALYSES_KEY = "edtech-analyses-v3";
const CHECKLIST_KEY = "edtech-checklists-v1";
const ANALYSES_CHUNK_SIZE = 400; // entries per storage key to stay well under 5MB

// Write analyses split across numbered chunk keys (sequential to avoid rate limit issues)
async function saveAnalysesChunked(obj, shared) {
  const entries = Object.entries(obj);
  const numChunks = Math.max(1, Math.ceil(entries.length / ANALYSES_CHUNK_SIZE));
  for (let i = 0; i < numChunks; i++) {
    const chunk = Object.fromEntries(entries.slice(i * ANALYSES_CHUNK_SIZE, (i + 1) * ANALYSES_CHUNK_SIZE));
    await window.storage.set(`${ANALYSES_KEY}-chunk-${i}`, JSON.stringify(chunk), shared);
  }
  // Write manifest last so it only exists once all chunks are written
  await window.storage.set(`${ANALYSES_KEY}-chunks`, String(numChunks), shared);
  return numChunks;
}

// Read all chunks back into a single object
async function loadAnalysesChunked(shared) {
  try {
    const manifest = await window.storage.get(`${ANALYSES_KEY}-chunks`, shared);
    if (!manifest) return null;
    const numChunks = parseInt(manifest.value, 10);
    if (isNaN(numChunks) || numChunks < 1) return null;
    const chunks = await Promise.all(
      Array.from({ length: numChunks }, (_, i) =>
        window.storage.get(`${ANALYSES_KEY}-chunk-${i}`, shared).catch(() => null)
      )
    );
    const merged = {};
    for (const c of chunks) {
      if (c?.value) Object.assign(merged, JSON.parse(c.value));
    }
    return merged;
  } catch { return null; }
}

// ─── Default county resource list (admin can modify) ─────────────────────────
const ADM = "APPROVED - District Managed"; // shorthand for default label
const DEFAULT_RESOURCES = [
  { id: "r1",  name: "Adobe Acrobat Pro", url: "https://acrobat.adobe.com", category: "Design", label: ADM },
  { id: "r2",  name: "Adobe Creative Cloud", url: "https://www.adobe.com/creativecloud", category: "Design", label: ADM },
  { id: "r3",  name: "Adobe Express", url: "https://express.adobe.com", category: "Design", label: ADM },
  { id: "r4",  name: "Adobe Firefly", url: "https://firefly.adobe.com", category: "Design", label: ADM },
  { id: "r5",  name: "Adobe Fresco", url: "https://www.adobe.com/products/fresco", category: "Design", label: ADM },
  { id: "r6",  name: "Adobe Illustrator", url: "https://www.adobe.com/products/illustrator", category: "Design", label: ADM },
  { id: "r7",  name: "Adobe Lightroom", url: "https://www.adobe.com/products/photoshop-lightroom", category: "Design", label: ADM },
  { id: "r8",  name: "Adobe Photoshop", url: "https://www.adobe.com/products/photoshop", category: "Design", label: ADM },
  { id: "r9",  name: "Adobe Podcast", url: "https://podcast.adobe.com", category: "Design", label: ADM },
  { id: "r10", name: "Adobe Premiere Pro", url: "https://www.adobe.com/products/premiere", category: "Design", label: ADM },
  { id: "r11", name: "Amira Learning", url: "https://www.amiralearning.com", category: "Learning", label: ADM },
  { id: "r12", name: "AP Classroom", url: "https://apclassroom.collegeboard.org", category: "Learning", label: "PARENT PERMISSION REQUIRED" },
  { id: "r13", name: "ASL Deafined", url: "https://www.asldeafined.com", category: "Language", label: ADM },
  { id: "r14", name: "Blue Panda", url: "https://www.bluepanda.school", category: "Learning", label: "PARENT PERMISSION REQUIRED" },
  { id: "r15", name: "Bluebook", url: "https://bluebook.app.collegeboard.org", category: "Assessment", label: "PARENT PERMISSION REQUIRED" },
  { id: "r16", name: "Boardmaker", url: "https://www.boardmakershare.com", category: "Learning", label: ADM },
  { id: "r17", name: "Brisk Teaching", url: "https://www.briskteaching.com", category: "Learning", label: ADM },
  { id: "r18", name: "Business U", url: "https://www.businessu.com", category: "Career Readiness", label: ADM },
  { id: "r19", name: "Canva", url: "https://www.canva.com", category: "Design", label: ADM },
  { id: "r20", name: "CareerSafe", url: "https://www.careersafeonline.com", category: "Career Readiness", label: ADM },
  { id: "r21", name: "Certiport", url: "https://certiport.pearsonvue.com", category: "Assessment", label: "UNRATED" },
  { id: "r22", name: "Cisco Networking Academy", url: "https://www.netacad.com", category: "Coding", label: "PARENT PERMISSION REQUIRED" },
  { id: "r23", name: "Code.org", url: "https://code.org", category: "Coding", label: "PARENT PERMISSION REQUIRED" },
  { id: "r24", name: "Common App", url: "https://www.commonapp.org", category: "Career Readiness", label: "PARENT PERMISSION REQUIRED" },
  { id: "r25", name: "CompTIA LTI 1.3", url: "https://www.comptia.org", category: "Assessment", label: ADM },
  { id: "r26", name: "CyberPatriot", url: "https://www.uscyberpatriot.org", category: "Cybersecurity", label: "DENIED" },
  { id: "r27", name: "Davis Art", url: "https://www.davisart.com", category: "Design", label: ADM },
  { id: "r28", name: "Desmos", url: "https://www.desmos.com", category: "Math", label: "DENIED" },
  { id: "r29", name: "Diffit", url: "https://diffit.me", category: "Learning", label: ADM },
  { id: "r30", name: "Dreambox", url: "https://www.dreambox.com", category: "Math", label: ADM },
  { id: "r31", name: "Finalsite ISD", url: "https://www.finalsite.com", category: "LMS", label: ADM },
  { id: "r32", name: "Gemini", url: "https://gemini.google.com", category: "Learning", label: ADM },
  { id: "r33", name: "GMetrix", url: "https://www.gmetrix.net", category: "Assessment" },
  { id: "r34", name: "Google Classroom", url: "https://classroom.google.com", category: "LMS", label: "DENIED" },
  { id: "r35", name: "Instinctive.app", url: "https://www.instinctive.app", category: "Learning", label: ADM },
  { id: "r36", name: "KC7 Cyber", url: "https://kc7cyber.com", category: "Coding" },
  { id: "r37", name: "KiwiWrite", url: "https://www.kiwiwrite.com", category: "Learning", label: ADM },
  { id: "r38", name: "Klett", url: "https://www.klett-usa.com", category: "Language", label: ADM },
  { id: "r39", name: "KnowledgeMatters", url: "https://www.knowledgematters.com", category: "Career Readiness", label: ADM },
  { id: "r40", name: "Kognity", url: "https://kognity.com", category: "Learning", label: ADM },
  { id: "r41", name: "Lingco Classroom", url: "https://www.lingco.io", category: "Language", label: ADM },
  { id: "r42", name: "MHS Online Assessment Center", url: "https://www.mhs.com", category: "Assessment", label: ADM },
  { id: "r43", name: "Minecraft Education Edition", url: "https://education.minecraft.net", category: "Coding", label: "APPROVED LIMITED" },
  { id: "r44", name: "MindPlay", url: "https://www.mindplay.com", category: "Learning", label: ADM },
  { id: "r45", name: "Music Theory Software", url: "https://www.risingsoftware.com", category: "Learning", label: ADM },
  { id: "r46", name: "MyCareerTech", url: "https://www.mycareertech.com", category: "Career Readiness", label: ADM },
  { id: "r47", name: "Mystery Science", url: "https://mysteryscience.com", category: "Learning", label: ADM },
  { id: "r48", name: "No Red Ink", url: "https://www.noredink.com", category: "Learning", label: ADM },
  { id: "r49", name: "Online Interactive Exercises Lumina", url: "https://www.bolchazy.com", category: "Learning", label: ADM },
  { id: "r50", name: "Packet Tracer", url: "https://www.netacad.com/courses/packet-tracer", category: "Coding", label: "PARENT PERMISSION REQUIRED" },
  { id: "r51", name: "Parchment", url: "https://www.parchment.com", category: "Career Readiness", label: ADM },
  { id: "r52", name: "picoCTF", url: "https://picoctf.org", category: "Cybersecurity", label: "DENIED" },
  { id: "r53", name: "Pivot Interactives", url: "https://www.pivotinteractives.com", category: "Learning", label: ADM },
  { id: "r54", name: "Pocket Lab", url: "https://www.thepocketlab.com", category: "Learning", label: ADM },
  { id: "r55", name: "PocketLab Notebook", url: "https://app.thepocketlab.com", category: "Learning", label: ADM },
  { id: "r56", name: "Prodigy", url: "https://www.prodigygame.com", category: "Learning", label: ADM },
  { id: "r57", name: "Progress Learning", url: "https://progresslearning.com", category: "Learning", label: ADM },
  { id: "r58", name: "Project STEM", url: "https://projectstem.org", category: "Coding", label: ADM },
  { id: "r59", name: "Read Naturally", url: "https://www.readnaturally.com", category: "Learning", label: ADM },
  { id: "r60", name: "Reading Plus", url: "https://www.readingplus.com", category: "Learning", label: ADM },
  { id: "r61", name: "ReadLive", url: "https://www.readnaturally.com/readlive", category: "Learning", label: ADM },
  { id: "r62", name: "Renaissance Fundamentals", url: "https://www.renaissance.com", category: "Learning", label: ADM },
  { id: "r63", name: "S/P2", url: "https://www.sp2.org", category: "Career Readiness", label: ADM },
  { id: "r64", name: "Savvas Realize", url: "https://www.savvasrealize.com", category: "LMS", label: ADM },
  { id: "r65", name: "SchoolDog", url: "https://www.schooldog.com", category: "Other", label: ADM },
  { id: "r66", name: "Scrible EDU", url: "https://www.scrible.com", category: "Learning", label: ADM },
  { id: "r67", name: "Senor Wooly", url: "https://www.senorwooly.com", category: "Language", label: ADM },
  { id: "r68", name: "Sight Reading Factory", url: "https://www.sightreadingfactory.com", category: "Learning", label: ADM },
  { id: "r69", name: "SIPPS", url: "https://www.collaborativeclassroom.org/programs/sipps", category: "Learning", label: ADM },
  { id: "r70", name: "Smartbox", url: "https://www.thinksmartbox.com", category: "Learning", label: ADM },
  { id: "r71", name: "SolidProfessor", url: "https://www.solidprofessor.com", category: "Coding", label: ADM },
  { id: "r72", name: "Soundtrap for Education", url: "https://www.soundtrap.com/edu", category: "Learning", label: ADM },
  { id: "r73", name: "Spirant.ai", url: "https://www.spirant.ai", category: "Learning", label: ADM },
  { id: "r74", name: "SPIRE", url: "https://eps.schoolspecialty.com/spire", category: "Learning", label: ADM },
  { id: "r75", name: "Sports Career Consulting", url: "https://www.sportscareercon.com", category: "Career Readiness", label: ADM },
  { id: "r76", name: "Study Island", url: "https://www.studyisland.com", category: "Assessment", label: ADM },
  { id: "r77", name: "Stukent", url: "https://www.stukent.com", category: "Learning", label: ADM },
  { id: "r78", name: "Talk Hiring", url: "https://www.talkhiring.com", category: "Career Readiness" },
  { id: "r79", name: "ThinkLink", url: "https://www.thinklink.org", category: "Assessment", label: ADM },
  { id: "r80", name: "This is School", url: "https://www.thisisschool.com", category: "Learning", label: ADM },
  { id: "r81", name: "Tooling U-SME", url: "https://www.toolingu.com", category: "Career Readiness", label: ADM },
  { id: "r82", name: "TryHackMe", url: "https://tryhackme.com", category: "Cybersecurity", label: "DENIED" },
  { id: "r83", name: "Turnitin Feedback Studio", url: "https://www.turnitin.com", category: "Assessment", label: ADM },
  { id: "r84", name: "uPAR", url: "https://www.upar.app", category: "Assessment", label: ADM },
  { id: "r85", name: "VHL Central", url: "https://www.vhlcentral.com", category: "Language", label: ADM },
  { id: "r86", name: "Virtual Job Shadowing", url: "https://www.virtualjobshadow.com", category: "Career Readiness", label: ADM },
  { id: "r87", name: "World History (Savvas)", url: "https://www.savvasrealize.com", category: "Learning", label: ADM },
  { id: "r88", name: "WWNorton", url: "https://www.wwnorton.com", category: "Learning", label: ADM },
  { id: "r89", name: "Yabla", url: "https://www.yabla.com", category: "Language", label: ADM },
  { id: "r90", name: "Your Money Vehicle", url: "https://www.yourmoneyvehicle.com", category: "Career Readiness", label: ADM },
  { id: "r91", name: "HOSA", url: "https://www.hosa.org", category: "Career Readiness", label: "PARENT PERMISSION REQUIRED" },
  { id: "r92", name: "Modern States", url: "https://modernstates.org", category: "Learning", label: "PARENT PERMISSION REQUIRED" },
  { id: "r93", name: "StudentAid.gov", url: "https://studentaid.gov", category: "Career Readiness", label: "PARENT PERMISSION REQUIRED" },
  { id: "r94", name: "16Personalities", url: "https://www.16personalities.com", category: "Learning", label: "DENIED" },
  { id: "r95", name: "22Learn", url: "https://www.22learn.com", category: "Learning", label: "DENIED" },
  { id: "r96", name: "360i Suite", url: "https://www.360isuite.com", category: "Learning", label: "DENIED" },
  { id: "r97", name: "3D Experience Certification Center", url: "https://www.3dexperiencecertificationcenter.com", category: "Art", label: "DENIED" },
  { id: "r98", name: "99Math", url: "https://www.99math.com", category: "Math", label: "DENIED" },
  { id: "r99", name: "AAPPL - K-12 Testing", url: "https://www.aapplk-12testing.com", category: "Assessment", label: "DENIED" },
  { id: "r100", name: "ABCmouse", url: "https://www.abcmouse.com", category: "Learning", label: "DENIED" },
  { id: "r101", name: "Ableton Live", url: "https://www.abletonlive.com", category: "Learning", label: "DENIED" },
  { id: "r102", name: "Access Video: Master Public Library Video Collection", url: "https://www.accessvideomasterpubliclibraryvideocollection.com", category: "Art", label: "DENIED" },
  { id: "r103", name: "Acrostic Poems", url: "https://www.acrosticpoems.com", category: "Language Arts", label: "DENIED" },
  { id: "r104", name: "Actively Learn", url: "https://www.activelylearn.com", category: "Learning", label: "DENIED" },
  { id: "r105", name: "Acuity Scheduling", url: "https://www.acuityscheduling.com", category: "Learning", label: "DENIED" },
  { id: "r106", name: "ADI Learning Hub", url: "https://www.adilearninghub.com", category: "Learning", label: "DENIED" },
  { id: "r107", name: "Aftershoot", url: "https://www.aftershoot.com", category: "Learning", label: "DENIED" },
  { id: "r108", name: "AI Dungeon", url: "https://www.aidungeon.com", category: "Learning", label: "DENIED" },
  { id: "r109", name: "AI Snapshots", url: "https://www.aisnapshots.com", category: "Learning", label: "DENIED" },
  { id: "r110", name: "ALEKS", url: "https://www.aleks.com", category: "Assessment", label: "DENIED" },
  { id: "r111", name: "Alelo", url: "https://www.alelo.com", category: "Learning", label: "DENIED" },
  { id: "r112", name: "All Animals A-Z List", url: "https://www.allanimalsa-zlist.com", category: "Science", label: "DENIED" },
  { id: "r113", name: "Almanack.ai", url: "https://www.almanackai.com", category: "Learning", label: "DENIED" },
  { id: "r114", name: "Amazon Prime Video", url: "https://www.primevideo.com", category: "Art", label: "DENIED" },
  { id: "r115", name: "Anaconda", url: "https://www.anaconda.com", category: "Learning", label: "DENIED" },
  { id: "r116", name: "Anatomage Table 9", url: "https://www.anatomagetable9.com", category: "Science", label: "DENIED" },
  { id: "r117", name: "Angry Birds", url: "https://www.angrybirds.com", category: "Games", label: "DENIED" },
  { id: "r118", name: "Angry Birds 2", url: "https://www.angrybirds2.com", category: "Games", label: "DENIED" },
  { id: "r119", name: "Animoto", url: "https://www.animoto.com", category: "Art", label: "DENIED" },
  { id: "r120", name: "Annotate.net", url: "https://www.annotatenet.com", category: "Learning", label: "DENIED" },
  { id: "r121", name: "AnswerGarden", url: "https://www.answergarden.com", category: "Learning", label: "DENIED" },
  { id: "r122", name: "AP Psychology", url: "https://www.appsychology.com", category: "Learning", label: "DENIED" },
  { id: "r123", name: "Applied Educational System Business", url: "https://www.appliededucationalsystembusiness.com", category: "Science", label: "DENIED" },
  { id: "r124", name: "AP® English", url: "https://www.apenglish.com", category: "Language Arts", label: "DENIED" },
  { id: "r125", name: "AP® Literature and Composition", url: "https://www.apliteratureandcomposition.com", category: "Language Arts", label: "DENIED" },
  { id: "r126", name: "Arcademics", url: "https://www.arcademics.com", category: "Art", label: "DENIED" },
  { id: "r127", name: "Archicad", url: "https://www.archicad.com", category: "Art", label: "DENIED" },
  { id: "r128", name: "ArcView GIS", url: "https://www.arcviewgis.com", category: "Learning", label: "DENIED" },
  { id: "r129", name: "Arduino IDE", url: "https://www.arduinoide.com", category: "Coding", label: "DENIED" },
  { id: "r130", name: "ArtForKidsHub.tv", url: "https://www.artforkidshubtv.com", category: "Art", label: "DENIED" },
  { id: "r131", name: "Articulate 360", url: "https://www.articulate360.com", category: "Art", label: "DENIED" },
  { id: "r132", name: "Artsonia", url: "https://www.artsonia.com", category: "Art", label: "DENIED" },
  { id: "r133", name: "Asana", url: "https://asana.com", category: "Productivity", label: "DENIED" },
  { id: "r134", name: "ASL University", url: "https://www.asluniversity.com", category: "World Languages", label: "DENIED" },
  { id: "r135", name: "ASL.ms", url: "https://www.aslms.com", category: "World Languages", label: "DENIED" },
  { id: "r136", name: "ASSISTments", url: "https://www.assistments.com", category: "Learning", label: "DENIED" },
  { id: "r137", name: "Atlas", url: "https://www.atlas.com", category: "Learning", label: "DENIED" },
  { id: "r138", name: "Audio Enhancement Epic System", url: "https://www.audioenhancementepicsystem.com", category: "Science", label: "DENIED" },
  { id: "r139", name: "Autocad", url: "https://www.autodesk.com/products/autocad", category: "Art", label: "DENIED" },
  { id: "r140", name: "B4UFLY App", url: "https://www.b4uflyapp.com", category: "Learning", label: "DENIED" },
  { id: "r141", name: "Baamboozle", url: "https://www.baamboozle.com", category: "Learning", label: "DENIED" },
  { id: "r142", name: "Baby Piano", url: "https://www.babypiano.com", category: "Music", label: "DENIED" },
  { id: "r143", name: "Badgy", url: "https://www.badgy.com", category: "Learning", label: "DENIED" },
  { id: "r144", name: "Bambu Lab", url: "https://www.bambulab.com", category: "Science", label: "DENIED" },
  { id: "r145", name: "Band", url: "https://www.band.com", category: "Music", label: "DENIED" },
  { id: "r146", name: "BARD Mobile", url: "https://www.bardmobile.com", category: "Learning", label: "DENIED" },
  { id: "r147", name: "Bee-Bot app", url: "https://www.bee-botapp.com", category: "Learning", label: "DENIED" },
  { id: "r148", name: "Biblionasium", url: "https://www.biblionasium.com", category: "Learning", label: "DENIED" },
  { id: "r149", name: "BibMe", url: "https://www.bibme.com", category: "Learning", label: "DENIED" },
  { id: "r150", name: "Bitmoji", url: "https://www.bitmoji.com", category: "Learning", label: "DENIED" },
  { id: "r151", name: "Bitsboard", url: "https://www.bitsboard.com", category: "Learning", label: "DENIED" },
  { id: "r152", name: "Blabberize", url: "https://www.blabberize.com", category: "Science", label: "DENIED" },
  { id: "r153", name: "Blackbird", url: "https://www.blackbird.com", category: "Learning", label: "DENIED" },
  { id: "r154", name: "Blogger", url: "https://www.blogger.com", category: "Learning", label: "DENIED" },
  { id: "r155", name: "Bloomsbury Academic", url: "https://www.bloomsburyacademic.com", category: "Art", label: "DENIED" },
  { id: "r156", name: "Bloomz", url: "https://www.bloomz.com", category: "Art", label: "DENIED" },
  { id: "r157", name: "Bloxels EDU", url: "https://www.bloxelsedu.com", category: "Learning", label: "DENIED" },
  { id: "r158", name: "Blue-Bot app", url: "https://www.blue-botapp.com", category: "Learning", label: "DENIED" },
  { id: "r159", name: "Boddle", url: "https://www.boddle.com", category: "Learning", label: "DENIED" },
  { id: "r160", name: "Bonpatron", url: "https://www.bonpatron.com", category: "Learning", label: "DENIED" },
  { id: "r161", name: "Bookshare", url: "https://www.bookshare.com", category: "Language Arts", label: "DENIED" },
  { id: "r162", name: "Booksource Classroom", url: "https://www.booksourceclassroom.com", category: "Language Arts", label: "DENIED" },
  { id: "r163", name: "Boolify", url: "https://www.boolify.com", category: "Learning", label: "DENIED" },
  { id: "r164", name: "Boom Writer", url: "https://www.boomwriter.com", category: "Learning", label: "DENIED" },
  { id: "r165", name: "Bouncy Balls", url: "https://www.bouncyballs.com", category: "Learning", label: "DENIED" },
  { id: "r166", name: "BrailleBlaster", url: "https://www.brailleblaster.com", category: "Special Education", label: "DENIED" },
  { id: "r167", name: "BrainPOP", url: "https://www.brainpop.com", category: "Learning", label: "DENIED" },
  { id: "r168", name: "Branching Minds", url: "https://www.branchingminds.com", category: "Learning", label: "DENIED" },
  { id: "r169", name: "Breathe Think Do with Sesame", url: "https://www.breathethinkdowithsesame.com", category: "Learning", label: "DENIED" },
  { id: "r170", name: "Brilliant", url: "https://www.brilliant.com", category: "Learning", label: "DENIED" },
  { id: "r171", name: "Brush Ninja", url: "https://www.brushninja.com", category: "Art", label: "DENIED" },
  { id: "r172", name: "Buncee", url: "https://www.buncee.com", category: "Learning", label: "DENIED" },
  { id: "r173", name: "Byrdseed.TV", url: "https://www.byrdseedtv.com", category: "Learning", label: "DENIED" },
  { id: "r174", name: "calc-medic", url: "https://www.calc-medic.com", category: "Math", label: "DENIED" },
  { id: "r175", name: "Calculate84", url: "https://www.calculate84.com", category: "Math", label: "DENIED" },
  { id: "r176", name: "Calendly", url: "https://www.calendly.com", category: "Learning", label: "DENIED" },
  { id: "r177", name: "CamScanner HD", url: "https://www.camscannerhd.com", category: "Learning", label: "DENIED" },
  { id: "r178", name: "Candy Crush Saga", url: "https://www.candycrushsaga.com", category: "Games", label: "DENIED" },
  { id: "r179", name: "CanPlan", url: "https://www.canplan.com", category: "Learning", label: "DENIED" },
  { id: "r180", name: "CapCut", url: "https://www.capcut.com", category: "Art", label: "DENIED" },
  { id: "r181", name: "Capit Learning", url: "https://www.capitlearning.com", category: "Learning", label: "DENIED" },
  { id: "r182", name: "Capti", url: "https://www.capti.com", category: "Learning", label: "DENIED" },
  { id: "r183", name: "Career Cruising", url: "https://www.careercruising.com", category: "Career Readiness", label: "DENIED" },
  { id: "r184", name: "CareerExplorer", url: "https://www.careerexplorer.com", category: "Career Readiness", label: "DENIED" },
  { id: "r185", name: "CCC Learning Hub", url: "https://www.ccclearninghub.com", category: "Learning", label: "DENIED" },
  { id: "r186", name: "Centervention", url: "https://www.centervention.com", category: "Learning", label: "DENIED" },
  { id: "r187", name: "Chaos.com", url: "https://www.chaoscom.com", category: "Learning", label: "DENIED" },
  { id: "r188", name: "Character.AI", url: "https://character.ai", category: "Learning", label: "DENIED" },
  { id: "r189", name: "Chatter Pix", url: "https://www.chatterpix.com", category: "Learning", label: "DENIED" },
  { id: "r190", name: "Chess for Kids", url: "https://www.chessforkids.com", category: "Learning", label: "DENIED" },
  { id: "r191", name: "Chief Architect Premier", url: "https://www.chiefarchitectpremier.com", category: "Learning", label: "DENIED" },
  { id: "r192", name: "Choice Board Creator Lite", url: "https://www.choiceboardcreatorlite.com", category: "Special Education", label: "DENIED" },
  { id: "r193", name: "Choice Limit", url: "https://www.choicelimit.com", category: "Learning", label: "DENIED" },
  { id: "r194", name: "CK-12", url: "https://www.ck-12.com", category: "Learning", label: "DENIED" },
  { id: "r195", name: "Class Creator", url: "https://www.classcreator.com", category: "Learning", label: "DENIED" },
  { id: "r196", name: "Class Dojo", url: "https://www.classdojo.com", category: "Learning", label: "DENIED" },
  { id: "r197", name: "Class Tools", url: "https://www.classtools.com", category: "Learning", label: "DENIED" },
  { id: "r198", name: "Classcraft", url: "https://www.classcraft.com", category: "Learning", label: "DENIED" },
  { id: "r199", name: "Classkick", url: "https://www.classkick.com", category: "Learning", label: "DENIED" },
  { id: "r200", name: "ClassQuestion", url: "https://www.classquestion.com", category: "Learning", label: "DENIED" },
  { id: "r201", name: "ClassTag", url: "https://www.classtag.com", category: "Learning", label: "DENIED" },
  { id: "r202", name: "Claude.ai", url: "https://claude.ai", category: "Learning", label: "DENIED" },
  { id: "r203", name: "Clear Touch Collage", url: "https://www.cleartouchcollage.com", category: "Learning", label: "DENIED" },
  { id: "r204", name: "ClipDrop", url: "https://www.clipdrop.com", category: "Art", label: "DENIED" },
  { id: "r205", name: "Clips", url: "https://www.clips.com", category: "Art", label: "DENIED" },
  { id: "r206", name: "Clusive", url: "https://www.clusive.com", category: "Special Education", label: "DENIED" },
  { id: "r207", name: "CMU Computer Science Academy", url: "https://www.cmucomputerscienceacademy.com", category: "Coding", label: "DENIED" },
  { id: "r208", name: "Code Quest Academy", url: "https://www.codequestacademy.com", category: "Coding", label: "DENIED" },
  { id: "r209", name: "Codecademy", url: "https://www.codecademy.com", category: "Coding", label: "DENIED" },
  { id: "r210", name: "CodeCombat", url: "https://www.codecombat.com", category: "Coding", label: "DENIED" },
  { id: "r211", name: "CodePen", url: "https://www.codepen.com", category: "Coding", label: "DENIED" },
  { id: "r212", name: "CoderZ", url: "https://www.coderz.com", category: "Coding", label: "DENIED" },
  { id: "r213", name: "CodeSpark Academy", url: "https://www.codesparkacademy.com", category: "Coding", label: "DENIED" },
  { id: "r214", name: "Coding Express LEGO Education", url: "https://www.codingexpresslegoeducation.com", category: "Coding", label: "DENIED" },
  { id: "r215", name: "Coding Rooms", url: "https://www.codingrooms.com", category: "Coding", label: "DENIED" },
  { id: "r216", name: "Codingbat", url: "https://www.codingbat.com", category: "Coding", label: "DENIED" },
  { id: "r217", name: "Codio", url: "https://www.codio.com", category: "Learning", label: "DENIED" },
  { id: "r218", name: "CollegeVine", url: "https://www.collegevine.com", category: "Career Readiness", label: "DENIED" },
  { id: "r219", name: "Collins Dictionary", url: "https://www.collinsdictionary.com", category: "Learning", label: "DENIED" },
  { id: "r220", name: "Comic Touch 2", url: "https://www.comictouch2.com", category: "Learning", label: "DENIED" },
  { id: "r221", name: "Common Core Sheets", url: "https://www.commoncoresheets.com", category: "Learning", label: "DENIED" },
  { id: "r222", name: "Conker", url: "https://www.conker.com", category: "Learning", label: "DENIED" },
  { id: "r223", name: "Cool Math Games", url: "https://www.coolmathgames.com", category: "Math", label: "DENIED" },
  { id: "r224", name: "Coolmath4kids.com", url: "https://www.coolmath4kids.com", category: "Math", label: "DENIED" },
  { id: "r225", name: "Corgi2", url: "https://www.corgi2.com", category: "Learning", label: "DENIED" },
  { id: "r226", name: "Counting 123", url: "https://www.counting123.com", category: "Math", label: "DENIED" },
  { id: "r227", name: "Cram", url: "https://www.cram.com", category: "Learning", label: "DENIED" },
  { id: "r228", name: "Creality Slicing Software", url: "https://www.crealityslicingsoftware.com", category: "Learning", label: "DENIED" },
  { id: "r229", name: "Cricut Design Space", url: "https://www.cricutdesignspace.com", category: "Science", label: "DENIED" },
  { id: "r230", name: "CritterCoin", url: "https://www.crittercoin.com", category: "Learning", label: "DENIED" },
  { id: "r231", name: "Crossy Road", url: "https://www.crossyroad.com", category: "Games", label: "DENIED" },
  { id: "r232", name: "CSAwesome", url: "https://www.csawesome.com", category: "Coding", label: "DENIED" },
  { id: "r233", name: "CTFtime", url: "https://www.ctftime.com", category: "Cybersecurity", label: "DENIED" },
  { id: "r234", name: "Cubelets", url: "https://www.cubelets.com", category: "Learning", label: "DENIED" },
  { id: "r235", name: "Cubelets Console", url: "https://www.cubeletsconsole.com", category: "Learning", label: "DENIED" },
  { id: "r236", name: "CueThink", url: "https://www.cuethink.com", category: "Learning", label: "DENIED" },
  { id: "r237", name: "CUR8", url: "https://www.cur8.com", category: "Learning", label: "DENIED" },
  { id: "r238", name: "Curiosity Stream", url: "https://www.curiositystream.com", category: "Learning", label: "DENIED" },
  { id: "r239", name: "Curioso", url: "https://www.curioso.com", category: "Learning", label: "DENIED" },
  { id: "r240", name: "Cursive Writing", url: "https://www.cursivewriting.com", category: "Language Arts", label: "DENIED" },
  { id: "r241", name: "Custom GPTs", url: "https://www.customgpts.com", category: "Learning", label: "DENIED" },
  { id: "r242", name: "Cut the Rope: Time Travel", url: "https://www.cuttheropetimetravel.com", category: "Learning", label: "DENIED" },
  { id: "r243", name: "Cyberchase", url: "https://www.cyberchase.com", category: "Cybersecurity", label: "DENIED" },
  { id: "r244", name: "D2L Brightspace", url: "https://www.d2lbrightspace.com", category: "Science", label: "DENIED" },
  { id: "r245", name: "D5 Render", url: "https://www.d5render.com", category: "Learning", label: "DENIED" },
  { id: "r246", name: "Dance Mat Typing", url: "https://www.dancemattyping.com", category: "Learning", label: "DENIED" },
  { id: "r247", name: "DaVinci Resolve", url: "https://www.davinciresolve.com", category: "Art", label: "DENIED" },
  { id: "r248", name: "Deck Toys", url: "https://www.decktoys.com", category: "Learning", label: "DENIED" },
  { id: "r249", name: "Delightex", url: "https://www.delightex.com", category: "Learning", label: "DENIED" },
  { id: "r250", name: "Described and Captioned Media Program", url: "https://www.describedandcaptionedmediaprogram.com", category: "Coding", label: "DENIED" },
  { id: "r251", name: "Diagrams.net (draw.io)", url: "https://www.diagramsnetdrawio.com", category: "Art", label: "DENIED" },
  { id: "r252", name: "Dictionary.com", url: "https://www.dictionary.com", category: "Learning", label: "DENIED" },
  { id: "r253", name: "Digital Theatre", url: "https://www.digitaltheatre.com", category: "Learning", label: "DENIED" },
  { id: "r254", name: "Discord", url: "https://discord.com", category: "Learning", label: "DENIED" },
  { id: "r255", name: "Discovery Education", url: "https://www.discoveryeducation.com", category: "Learning", label: "DENIED" },
  { id: "r256", name: "Disney+", url: "https://www.disneyplus.com", category: "Learning", label: "DENIED" },
  { id: "r257", name: "Distributive Education Clubs of America", url: "https://www.distributiveeducationclubsofamerica.com", category: "Learning", label: "DENIED" },
  { id: "r258", name: "DJI Flight Simulator", url: "https://www.djiflightsimulator.com", category: "Learning", label: "DENIED" },
  { id: "r259", name: "DJI Fly", url: "https://www.djifly.com", category: "Learning", label: "DENIED" },
  { id: "r260", name: "DK Find Out", url: "https://www.dkfindout.com", category: "Learning", label: "DENIED" },
  { id: "r261", name: "Do Ink Green Screen", url: "https://www.doinkgreenscreen.com", category: "Learning", label: "DENIED" },
  { id: "r262", name: "Do2Learn", url: "https://www.do2learn.com", category: "Learning", label: "DENIED" },
  { id: "r263", name: "Dogo News", url: "https://www.dogonews.com", category: "Learning", label: "DENIED" },
  { id: "r264", name: "Dotstorming", url: "https://www.dotstorming.com", category: "Learning", label: "DENIED" },
  { id: "r265", name: "Dreamscape", url: "https://www.dreamscape.com", category: "Learning", label: "DENIED" },
  { id: "r266", name: "Drone Blocks", url: "https://www.droneblocks.com", category: "Learning", label: "DENIED" },
  { id: "r267", name: "Dropbox", url: "https://www.dropbox.com", category: "Productivity", label: "DENIED" },
  { id: "r268", name: "Ducksters", url: "https://www.ducksters.com", category: "Learning", label: "DENIED" },
  { id: "r269", name: "Duolingo", url: "https://www.duolingo.com", category: "World Languages", label: "DENIED" },
  { id: "r270", name: "DW Publications", url: "https://www.dwpublications.com", category: "Learning", label: "DENIED" },
  { id: "r271", name: "e-HallPass", url: "https://www.e-hallpass.com", category: "Learning", label: "DENIED" },
  { id: "r272", name: "Early Literacy Skills Builder (ELSB) For Older Students", url: "https://www.earlyliteracyskillsbuilderelsbforolderstudents.com", category: "Language Arts", label: "DENIED" },
  { id: "r273", name: "Ears Farmland", url: "https://www.earsfarmland.com", category: "Learning", label: "DENIED" },
  { id: "r274", name: "EarSketch", url: "https://www.earsketch.com", category: "Art", label: "DENIED" },
  { id: "r275", name: "Easel By TPT", url: "https://www.easelbytpt.com", category: "Learning", label: "DENIED" },
  { id: "r276", name: "Easy CBM", url: "https://www.easycbm.com", category: "Learning", label: "DENIED" },
  { id: "r277", name: "Easy Reader", url: "https://www.easyreader.com", category: "Language Arts", label: "DENIED" },
  { id: "r278", name: "Easybib", url: "https://www.easybib.com", category: "Learning", label: "DENIED" },
  { id: "r279", name: "Easycode", url: "https://www.easycode.com", category: "Coding", label: "DENIED" },
  { id: "r280", name: "Eat 2 Win App", url: "https://www.eat2winapp.com", category: "Learning", label: "DENIED" },
  { id: "r281", name: "Eclipse", url: "https://www.eclipse.com", category: "Art", label: "DENIED" },
  { id: "r282", name: "Econ Lowdown", url: "https://www.econlowdown.com", category: "Learning", label: "DENIED" },
  { id: "r283", name: "EdCafe AI", url: "https://www.edcafeai.com", category: "Learning", label: "DENIED" },
  { id: "r284", name: "edHelper", url: "https://www.edhelper.com", category: "Learning", label: "DENIED" },
  { id: "r285", name: "edia", url: "https://www.edia.com", category: "Learning", label: "DENIED" },
  { id: "r286", name: "EDpuzzle", url: "https://www.edpuzzle.com", category: "Learning", label: "DENIED" },
  { id: "r287", name: "Educandy", url: "https://www.educandy.com", category: "Learning", label: "DENIED" },
  { id: "r288", name: "Educaplay", url: "https://www.educaplay.com", category: "Games", label: "DENIED" },
  { id: "r289", name: "Education Perfect", url: "https://www.educationperfect.com", category: "Learning", label: "DENIED" },
  { id: "r290", name: "Educreations", url: "https://www.educreations.com", category: "Learning", label: "DENIED" },
  { id: "r291", name: "edX", url: "https://www.edx.com", category: "Learning", label: "DENIED" },
  { id: "r292", name: "eDynamic Learning", url: "https://www.edynamiclearning.com", category: "Learning", label: "DENIED" },
  { id: "r293", name: "eLearning", url: "https://www.elearning.com", category: "Learning", label: "DENIED" },
  { id: "r294", name: "Elegoo 3D Printing", url: "https://www.elegoo3dprinting.com", category: "Art", label: "DENIED" },
  { id: "r295", name: "Ella", url: "https://www.ella.com", category: "Learning", label: "DENIED" },
  { id: "r296", name: "Ellii", url: "https://www.ellii.com", category: "Learning", label: "DENIED" },
  { id: "r297", name: "Endless Apps", url: "https://www.endlessapps.com", category: "Learning", label: "DENIED" },
  { id: "r298", name: "Engineering Tomorrow", url: "https://www.engineeringtomorrow.com", category: "Learning", label: "DENIED" },
  { id: "r299", name: "Epic", url: "https://www.epic.com", category: "Learning", label: "DENIED" },
  { id: "r300", name: "eSpark", url: "https://www.espark.com", category: "Learning", label: "DENIED" },
  { id: "r301", name: "ETYMonline", url: "https://www.etymonline.com", category: "Learning", label: "DENIED" },
  { id: "r302", name: "Evernote Scannable", url: "https://www.evernotescannable.com", category: "Learning", label: "DENIED" },
  { id: "r303", name: "Examity", url: "https://www.examity.com", category: "Assessment", label: "DENIED" },
  { id: "r304", name: "ExamView", url: "https://www.examview.com", category: "Assessment", label: "DENIED" },
  { id: "r305", name: "Explain Everything", url: "https://www.explaineverything.com", category: "Learning", label: "DENIED" },
  { id: "r306", name: "Extempore", url: "https://www.extempore.com", category: "Learning", label: "DENIED" },
  { id: "r307", name: "Fact Monster", url: "https://www.factmonster.com", category: "Learning", label: "DENIED" },
  { id: "r308", name: "Factile", url: "https://www.factile.com", category: "Learning", label: "DENIED" },
  { id: "r309", name: "Factordle", url: "https://www.factordle.com", category: "Learning", label: "DENIED" },
  { id: "r310", name: "Fan School", url: "https://www.fanschool.com", category: "Learning", label: "DENIED" },
  { id: "r311", name: "FBI-SOS Cyber Surf Island", url: "https://www.fbi-soscybersurfisland.com", category: "Cybersecurity", label: "DENIED" },
  { id: "r312", name: "FBLA", url: "https://www.fbla.com", category: "Career Readiness", label: "DENIED" },
  { id: "r313", name: "FBLA Online Registration System", url: "https://www.fblaonlineregistrationsystem.com", category: "Science", label: "DENIED" },
  { id: "r314", name: "FigJam", url: "https://www.figjam.com", category: "Learning", label: "DENIED" },
  { id: "r315", name: "Figma", url: "https://www.figma.com", category: "Art", label: "DENIED" },
  { id: "r316", name: "Fireworks Arcade", url: "https://www.fireworksarcade.com", category: "Art", label: "DENIED" },
  { id: "r317", name: "FlipHTML5", url: "https://www.fliphtml5.com", category: "Learning", label: "DENIED" },
  { id: "r318", name: "Flipsnack", url: "https://www.flipsnack.com", category: "Learning", label: "DENIED" },
  { id: "r319", name: "Floorplan Creator", url: "https://www.floorplancreator.com", category: "Art", label: "DENIED" },
  { id: "r320", name: "Floorplanner", url: "https://www.floorplanner.com", category: "Art", label: "DENIED" },
  { id: "r321", name: "Flow Lab", url: "https://www.flowlab.com", category: "Science", label: "DENIED" },
  { id: "r322", name: "Fluency Matters", url: "https://www.fluencymatters.com", category: "Learning", label: "DENIED" },
  { id: "r323", name: "FluentKey", url: "https://www.fluentkey.com", category: "Learning", label: "DENIED" },
  { id: "r324", name: "Fluid Simulation", url: "https://www.fluidsimulation.com", category: "Learning", label: "DENIED" },
  { id: "r325", name: "Freckle Education", url: "https://www.freckleeducation.com", category: "Learning", label: "DENIED" },
  { id: "r326", name: "Free-Training-Tutorial.com", url: "https://www.free-training-tutorialcom.com", category: "Learning", label: "DENIED" },
  { id: "r327", name: "FreeFlight Mini", url: "https://www.freeflightmini.com", category: "Learning", label: "DENIED" },
  { id: "r328", name: "Freesound", url: "https://www.freesound.com", category: "Music", label: "DENIED" },
  { id: "r329", name: "French Games", url: "https://www.frenchgames.com", category: "World Languages", label: "DENIED" },
  { id: "r330", name: "Fruit Ninja Academy", url: "https://www.fruitninjaacademy.com", category: "Art", label: "DENIED" },
  { id: "r331", name: "Fun Run 3", url: "https://www.funrun3.com", category: "Games", label: "DENIED" },
  { id: "r332", name: "Fundamentals of Business Exam", url: "https://www.fundamentalsofbusinessexam.com", category: "Career Readiness", label: "DENIED" },
  { id: "r333", name: "Fusion 360", url: "https://www.autodesk.com/products/fusion-360", category: "Art", label: "DENIED" },
  { id: "r334", name: "Future Farmers of America", url: "https://www.futurefarmersofamerica.com", category: "Learning", label: "DENIED" },
  { id: "r335", name: "G-W Online", url: "https://www.g-wonline.com", category: "Learning", label: "DENIED" },
  { id: "r336", name: "Gale In Context: Opposing Viewpoints", url: "https://www.galeincontextopposingviewpoints.com", category: "Language Arts", label: "DENIED" },
  { id: "r337", name: "Gameplan", url: "https://www.gameplan.com", category: "Games", label: "DENIED" },
  { id: "r338", name: "Gamestar Mechanic", url: "https://www.gamestarmechanic.com", category: "Games", label: "DENIED" },
  { id: "r339", name: "Gamma", url: "https://www.gamma.com", category: "Learning", label: "DENIED" },
  { id: "r340", name: "GCFGlobal", url: "https://www.gcfglobal.com", category: "Learning", label: "DENIED" },
  { id: "r341", name: "GDevelop", url: "https://www.gdevelop.com", category: "Learning", label: "DENIED" },
  { id: "r342", name: "GemKids", url: "https://www.gemkids.com", category: "Learning", label: "DENIED" },
  { id: "r343", name: "Gen-Z Media", url: "https://www.gen-zmedia.com", category: "Learning", label: "DENIED" },
  { id: "r344", name: "Genius", url: "https://www.genius.com", category: "Learning", label: "DENIED" },
  { id: "r345", name: "Genius Scan", url: "https://www.geniusscan.com", category: "Learning", label: "DENIED" },
  { id: "r346", name: "Geoguessr", url: "https://www.geoguessr.com", category: "Social Studies", label: "DENIED" },
  { id: "r347", name: "Geometer Sketchpad", url: "https://www.geometersketchpad.com", category: "Art", label: "DENIED" },
  { id: "r348", name: "Geometry Dash", url: "https://www.geometrydash.com", category: "Math", label: "DENIED" },
  { id: "r349", name: "Get Into Energy", url: "https://www.getintoenergy.com", category: "Learning", label: "DENIED" },
  { id: "r350", name: "Get Into Theatre", url: "https://www.getintotheatre.com", category: "Learning", label: "DENIED" },
  { id: "r351", name: "Girls Who Code", url: "https://www.girlswhocode.com", category: "Coding", label: "DENIED" },
  { id: "r352", name: "Go Fan", url: "https://www.gofan.com", category: "Learning", label: "DENIED" },
  { id: "r353", name: "Godot Engine", url: "https://www.godotengine.com", category: "Learning", label: "DENIED" },
  { id: "r354", name: "GoGuardian Teacher", url: "https://www.goguardianteacher.com", category: "Learning", label: "DENIED" },
  { id: "r355", name: "GoNoodle", url: "https://www.gonoodle.com", category: "Learning", label: "DENIED" },
  { id: "r356", name: "Google Earth", url: "https://earth.google.com", category: "Science", label: "DENIED" },
  { id: "r357", name: "Google Lens", url: "https://lens.google.com", category: "Productivity", label: "DENIED" },
  { id: "r358", name: "Google Scholar", url: "https://scholar.google.com", category: "Productivity", label: "DENIED" },
  { id: "r359", name: "GooseChase EDU", url: "https://www.goosechaseedu.com", category: "Learning", label: "DENIED" },
  { id: "r360", name: "GoTalk NOW", url: "https://www.gotalknow.com", category: "Learning", label: "DENIED" },
  { id: "r361", name: "GoTalk NOW LITE", url: "https://www.gotalknowlite.com", category: "Learning", label: "DENIED" },
  { id: "r362", name: "GoToMeeting", url: "https://www.gotomeeting.com", category: "Productivity", label: "DENIED" },
  { id: "r363", name: "GoVenture", url: "https://www.goventure.com", category: "Learning", label: "DENIED" },
  { id: "r364", name: "GPB Learning Media", url: "https://www.gpblearningmedia.com", category: "Learning", label: "DENIED" },
  { id: "r365", name: "GrabCAD", url: "https://www.grabcad.com", category: "Art", label: "DENIED" },
  { id: "r366", name: "GradeCam", url: "https://www.gradecam.com", category: "Career Readiness", label: "DENIED" },
  { id: "r367", name: "Gradescope", url: "https://www.gradescope.com", category: "Assessment", label: "DENIED" },
  { id: "r368", name: "Gradient Learning", url: "https://www.gradientlearning.com", category: "Learning", label: "DENIED" },
  { id: "r369", name: "Grammarly", url: "https://www.grammarly.com", category: "Language Arts", label: "DENIED" },
  { id: "r370", name: "Grouper", url: "https://www.grouper.com", category: "Learning", label: "DENIED" },
  { id: "r371", name: "Groupme", url: "https://www.groupme.com", category: "Productivity", label: "DENIED" },
  { id: "r372", name: "Gynzy", url: "https://www.gynzy.com", category: "Learning", label: "DENIED" },
  { id: "r373", name: "Hack The Box", url: "https://www.hackthebox.com", category: "Cybersecurity", label: "DENIED" },
  { id: "r374", name: "Harvard T.H. Chan School of Public Health", url: "https://www.harvardthchanschoolofpublichealth.com", category: "Learning", label: "DENIED" },
  { id: "r375", name: "HatchXR", url: "https://www.hatchxr.com", category: "Learning", label: "DENIED" },
  { id: "r376", name: "Heat Pad - Relaxing Surface", url: "https://www.heatpadrelaxingsurface.com", category: "Learning", label: "DENIED" },
  { id: "r377", name: "Hello History", url: "https://www.hellohistory.com", category: "Language Arts", label: "DENIED" },
  { id: "r378", name: "HelpKidzLearn", url: "https://www.helpkidzlearn.com", category: "Special Education", label: "DENIED" },
  { id: "r379", name: "HeyGen", url: "https://www.heygen.com", category: "Learning", label: "DENIED" },
  { id: "r380", name: "Hill Climb Racing", url: "https://www.hillclimbracing.com", category: "Games", label: "DENIED" },
  { id: "r381", name: "Hit the Button Math", url: "https://www.hitthebuttonmath.com", category: "Math", label: "DENIED" },
  { id: "r382", name: "Homeroom", url: "https://www.homeroom.com", category: "Learning", label: "DENIED" },
  { id: "r383", name: "Homestyler", url: "https://www.homestyler.com", category: "Learning", label: "DENIED" },
  { id: "r384", name: "Homework Help", url: "https://www.homeworkhelp.com", category: "Learning", label: "DENIED" },
  { id: "r385", name: "Hooda Math Mobile", url: "https://www.hoodamathmobile.com", category: "Math", label: "DENIED" },
  { id: "r386", name: "How The Market Works", url: "https://www.howthemarketworks.com", category: "Learning", label: "DENIED" },
  { id: "r387", name: "Hudl", url: "https://www.hudl.com", category: "Learning", label: "DENIED" },
  { id: "r388", name: "Huion - Drawing Tablets and Digital Pens", url: "https://www.huiondrawingtabletsanddigitalpens.com", category: "Art", label: "DENIED" },
  { id: "r389", name: "Hulu", url: "https://www.hulu.com", category: "Learning", label: "DENIED" },
  { id: "r390", name: "HumanWare Explore Magnifier", url: "https://www.humanwareexploremagnifier.com", category: "Special Education", label: "DENIED" },
  { id: "r391", name: "Hypatia", url: "https://www.hypatia.com", category: "Learning", label: "DENIED" },
  { id: "r392", name: "iAnnotate PDF", url: "https://www.iannotatepdf.com", category: "Learning", label: "DENIED" },
  { id: "r393", name: "IBM Watson", url: "https://www.ibmwatson.com", category: "Learning", label: "DENIED" },
  { id: "r394", name: "iCell", url: "https://www.icell.com", category: "Learning", label: "DENIED" },
  { id: "r395", name: "iCivics", url: "https://www.icivics.com", category: "Social Studies", label: "DENIED" },
  { id: "r396", name: "iDashboards", url: "https://www.idashboards.com", category: "Learning", label: "DENIED" },
  { id: "r397", name: "Ideogram", url: "https://www.ideogram.com", category: "Learning", label: "DENIED" },
  { id: "r398", name: "iknowit", url: "https://www.iknowit.com", category: "Learning", label: "DENIED" },
  { id: "r399", name: "iNaturalist", url: "https://www.inaturalist.com", category: "Learning", label: "DENIED" },
  { id: "r400", name: "Incredibox", url: "https://www.incredibox.com", category: "Music", label: "DENIED" },
  { id: "r401", name: "Infant Zoo: Sounds For Baby", url: "https://www.infantzoosoundsforbaby.com", category: "Music", label: "DENIED" },
  { id: "r402", name: "Inference Ace", url: "https://www.inferenceace.com", category: "Learning", label: "DENIED" },
  { id: "r403", name: "Intelligent Learning Platform", url: "https://www.intelligentlearningplatform.com", category: "Productivity", label: "DENIED" },
  { id: "r404", name: "InThinking", url: "https://www.inthinking.com", category: "Learning", label: "DENIED" },
  { id: "r405", name: "iScanner", url: "https://www.iscanner.com", category: "Learning", label: "DENIED" },
  { id: "r406", name: "Jeopardy Labs", url: "https://www.jeopardylabs.com", category: "Science", label: "DENIED" },
  { id: "r407", name: "Jigsaw Puzzles Epic", url: "https://www.jigsawpuzzlesepic.com", category: "Learning", label: "DENIED" },
  { id: "r408", name: "Jotform", url: "https://www.jotform.com", category: "Productivity", label: "DENIED" },
  { id: "r409", name: "JSTOR", url: "https://www.jstor.org", category: "Learning", label: "DENIED" },
  { id: "r410", name: "JuiceMind", url: "https://www.juicemind.com", category: "Learning", label: "DENIED" },
  { id: "r411", name: "Just for Kids Streaming Collection", url: "https://www.justforkidsstreamingcollection.com", category: "Learning", label: "DENIED" },
  { id: "r412", name: "Kami", url: "https://www.kami.com", category: "Learning", label: "DENIED" },
  { id: "r413", name: "Kanbanchi", url: "https://www.kanbanchi.com", category: "Learning", label: "DENIED" },
  { id: "r414", name: "KC7", url: "https://www.kc7.com", category: "Learning", label: "DENIED" },
  { id: "r415", name: "Key Hero Typing Test", url: "https://www.keyherotypingtest.com", category: "Assessment", label: "DENIED" },
  { id: "r416", name: "Keyboard Climber", url: "https://www.keyboardclimber.com", category: "Learning", label: "DENIED" },
  { id: "r417", name: "Khan Academy", url: "https://www.khanacademy.org", category: "Art", label: "DENIED" },
  { id: "r418", name: "Khan Academy Kids", url: "https://www.khanacademy.org/kids", category: "Art", label: "DENIED" },
  { id: "r419", name: "Khanmigo", url: "https://www.khanacademy.org/khan-labs", category: "Learning", label: "DENIED" },
  { id: "r420", name: "Kialo Edu", url: "https://www.kialoedu.com", category: "Learning", label: "DENIED" },
  { id: "r421", name: "Kide Science", url: "https://www.kidescience.com", category: "Science", label: "DENIED" },
  { id: "r422", name: "Kids Discover", url: "https://www.kidsdiscover.com", category: "Learning", label: "DENIED" },
  { id: "r423", name: "Kids World Travel Guide", url: "https://www.kidsworldtravelguide.com", category: "Social Studies", label: "DENIED" },
  { id: "r424", name: "KidsCBC", url: "https://www.kidscbc.com", category: "Learning", label: "DENIED" },
  { id: "r425", name: "KidzType", url: "https://www.kidztype.com", category: "Learning", label: "DENIED" },
  { id: "r426", name: "Kodable", url: "https://www.kodable.com", category: "Learning", label: "DENIED" },
  { id: "r427", name: "Kurzweil 3000", url: "https://www.kurzweil3000.com", category: "Special Education", label: "DENIED" },
  { id: "r428", name: "LanSchool Air", url: "https://www.lanschoolair.com", category: "Learning", label: "DENIED" },
  { id: "r429", name: "Lanschool Classic", url: "https://www.lanschoolclassic.com", category: "Learning", label: "DENIED" },
  { id: "r430", name: "Leap For Literacy", url: "https://www.leapforliteracy.com", category: "Language Arts", label: "DENIED" },
  { id: "r431", name: "Learn360", url: "https://www.learn360.com", category: "Learning", label: "DENIED" },
  { id: "r432", name: "Learn4Good", url: "https://www.learn4good.com", category: "Learning", label: "DENIED" },
  { id: "r433", name: "Learning Ally", url: "https://www.learningally.com", category: "Learning", label: "DENIED" },
  { id: "r434", name: "Learning.com EasyTech", url: "https://www.learningcomeasytech.com", category: "Learning", label: "DENIED" },
  { id: "r435", name: "LearnThatWord", url: "https://www.learnthatword.com", category: "Language Arts", label: "DENIED" },
  { id: "r436", name: "Lego Education", url: "https://www.legoeducation.com", category: "Learning", label: "DENIED" },
  { id: "r437", name: "Lesson Launchpad", url: "https://www.lessonlaunchpad.com", category: "Learning", label: "DENIED" },
  { id: "r438", name: "LessonPix", url: "https://www.lessonpix.com", category: "Learning", label: "DENIED" },
  { id: "r439", name: "Letterschool - Learn to Write", url: "https://www.letterschoollearntowrite.com", category: "Learning", label: "DENIED" },
  { id: "r440", name: "LibraryTrac", url: "https://www.librarytrac.com", category: "Learning", label: "DENIED" },
  { id: "r441", name: "Lightbox Learning", url: "https://www.lightboxlearning.com", category: "Learning", label: "DENIED" },
  { id: "r442", name: "Lightworks", url: "https://www.lightworks.com", category: "Learning", label: "DENIED" },
  { id: "r443", name: "LinkedIn Learning", url: "https://www.linkedinlearning.com", category: "Learning", label: "DENIED" },
  { id: "r444", name: "LINKtivity Learning", url: "https://www.linktivitylearning.com", category: "Learning", label: "DENIED" },
  { id: "r445", name: "Lino", url: "https://www.lino.com", category: "Learning", label: "DENIED" },
  { id: "r446", name: "Literably", url: "https://www.literably.com", category: "Learning", label: "DENIED" },
  { id: "r447", name: "Little Finder", url: "https://www.littlefinder.com", category: "Learning", label: "DENIED" },
  { id: "r448", name: "Little Matchups ABC", url: "https://www.littlematchupsabc.com", category: "Learning", label: "DENIED" },
  { id: "r449", name: "Liveworksheets", url: "https://www.liveworksheets.com", category: "Learning", label: "DENIED" },
  { id: "r450", name: "LockLizard", url: "https://www.locklizard.com", category: "Learning", label: "DENIED" },
  { id: "r451", name: "Loom: Screen Recording & Video", url: "https://www.loomscreenrecordingvideo.com", category: "Art", label: "DENIED" },
  { id: "r452", name: "Lote4kids", url: "https://www.lote4kids.com", category: "Learning", label: "DENIED" },
  { id: "r453", name: "Lucidspark", url: "https://www.lucidspark.com", category: "Learning", label: "DENIED" },
  { id: "r454", name: "Lumio", url: "https://www.lumio.com", category: "Learning", label: "DENIED" },
  { id: "r455", name: "Lumion", url: "https://www.lumion.com", category: "Learning", label: "DENIED" },
  { id: "r456", name: "MAD-learn", url: "https://www.mad-learn.com", category: "Learning", label: "DENIED" },
  { id: "r457", name: "MagicStudent", url: "https://www.magicstudent.com", category: "Learning", label: "DENIED" },
  { id: "r458", name: "Main Idea - Sentences", url: "https://www.mainideasentences.com", category: "Learning", label: "DENIED" },
  { id: "r459", name: "Makeblock", url: "https://www.makeblock.com", category: "Learning", label: "DENIED" },
  { id: "r460", name: "Maker Brane - Digital Building Blocks", url: "https://www.makerbranedigitalbuildingblocks.com", category: "Learning", label: "DENIED" },
  { id: "r461", name: "Makey Makey", url: "https://www.makeymakey.com", category: "Learning", label: "DENIED" },
  { id: "r462", name: "MasterMines", url: "https://www.mastermines.com", category: "Learning", label: "DENIED" },
  { id: "r463", name: "Math Drills Lite", url: "https://www.mathdrillslite.com", category: "Math", label: "DENIED" },
  { id: "r464", name: "Math Force", url: "https://www.mathforce.com", category: "Math", label: "DENIED" },
  { id: "r465", name: "Math Games", url: "https://www.mathgames.com", category: "Math", label: "DENIED" },
  { id: "r466", name: "Math Medic", url: "https://www.mathmedic.com", category: "Math", label: "DENIED" },
  { id: "r467", name: "Math Paper", url: "https://www.mathpaper.com", category: "Math", label: "DENIED" },
  { id: "r468", name: "Math Playground", url: "https://www.mathplayground.com", category: "Math", label: "DENIED" },
  { id: "r469", name: "MathFlash", url: "https://www.mathflash.com", category: "Math", label: "DENIED" },
  { id: "r470", name: "MathGPT", url: "https://www.mathgpt.com", category: "Math", label: "DENIED" },
  { id: "r471", name: "MathHelp.com", url: "https://www.mathhelpcom.com", category: "Math", label: "DENIED" },
  { id: "r472", name: "Mathseeds", url: "https://www.mathseeds.com", category: "Math", label: "DENIED" },
  { id: "r473", name: "Mathsisfun.com", url: "https://www.mathsisfun.com", category: "Math", label: "DENIED" },
  { id: "r474", name: "MathsPad", url: "https://www.mathspad.com", category: "Math", label: "DENIED" },
  { id: "r475", name: "MATLAB and Simulink Online Courses", url: "https://www.matlabandsimulinkonlinecourses.com", category: "Science", label: "DENIED" },
  { id: "r476", name: "MATLAB Grader", url: "https://www.matlabgrader.com", category: "Science", label: "DENIED" },
  { id: "r477", name: "Mendeley", url: "https://www.mendeley.com", category: "Learning", label: "DENIED" },
  { id: "r478", name: "Mentimeter", url: "https://www.mentimeter.com", category: "Learning", label: "DENIED" },
  { id: "r479", name: "Merriam-Webster Dictionary", url: "https://www.merriam-websterdictionary.com", category: "Learning", label: "DENIED" },
  { id: "r480", name: "Merriam-Webster Word Central", url: "https://www.merriam-websterwordcentral.com", category: "Language Arts", label: "DENIED" },
  { id: "r481", name: "Meta Quest for Business", url: "https://www.metaquestforbusiness.com", category: "Career Readiness", label: "DENIED" },
  { id: "r482", name: "Middle School Personal Finance", url: "https://www.middleschoolpersonalfinance.com", category: "Career Readiness", label: "DENIED" },
  { id: "r483", name: "Mindomo", url: "https://www.mindomo.com", category: "Learning", label: "DENIED" },
  { id: "r484", name: "Minecraft", url: "https://www.minecraft.net", category: "Games", label: "DENIED" },
  { id: "r485", name: "Minion Rush", url: "https://www.minionrush.com", category: "Games", label: "DENIED" },
  { id: "r486", name: "Miro", url: "https://www.miro.com", category: "Learning", label: "DENIED" },
  { id: "r487", name: "Mission US", url: "https://www.missionus.com", category: "Social Studies", label: "DENIED" },
  { id: "r488", name: "Moodle", url: "https://www.moodle.com", category: "LMS", label: "DENIED" },
  { id: "r489", name: "Multimedia Posters", url: "https://www.multimediaposters.com", category: "Learning", label: "DENIED" },
  { id: "r490", name: "MuseClass", url: "https://www.museclass.com", category: "Learning", label: "DENIED" },
  { id: "r491", name: "Musescore", url: "https://www.musescore.com", category: "Music", label: "DENIED" },
  { id: "r492", name: "Music Play Themes and Variations", url: "https://www.musicplaythemesandvariations.com", category: "Music", label: "DENIED" },
  { id: "r493", name: "Music Tech Teacher", url: "https://www.musictechteacher.com", category: "Music", label: "DENIED" },
  { id: "r494", name: "My Baby Piano Lite", url: "https://www.mybabypianolite.com", category: "Music", label: "DENIED" },
  { id: "r495", name: "My Homework App", url: "https://www.myhomeworkapp.com", category: "Learning", label: "DENIED" },
  { id: "r496", name: "My Little Suitcase", url: "https://www.mylittlesuitcase.com", category: "Learning", label: "DENIED" },
  { id: "r497", name: "My Panda Chef Kitchen", url: "https://www.mypandachefkitchen.com", category: "Learning", label: "DENIED" },
  { id: "r498", name: "My Plate", url: "https://www.myplate.com", category: "Learning", label: "DENIED" },
  { id: "r499", name: "My PlayHome app", url: "https://www.myplayhomeapp.com", category: "Games", label: "DENIED" },
  { id: "r500", name: "My Town", url: "https://www.mytown.com", category: "Learning", label: "DENIED" },
  { id: "r501", name: "MyBib", url: "https://www.mybib.com", category: "Learning", label: "DENIED" },
  { id: "r502", name: "NaNoWriMo", url: "https://www.nanowrimo.com", category: "Learning", label: "DENIED" },
  { id: "r503", name: "National Center for Education Statistics", url: "https://www.nationalcenterforeducationstatistics.com", category: "Learning", label: "DENIED" },
  { id: "r504", name: "National Geographic Kids", url: "https://www.nationalgeographickids.com", category: "Learning", label: "DENIED" },
  { id: "r505", name: "National Parks Service", url: "https://www.nationalparksservice.com", category: "Learning", label: "DENIED" },
  { id: "r506", name: "National Spanish Exam", url: "https://www.nationalspanishexam.com", category: "Assessment", label: "DENIED" },
  { id: "r507", name: "National Student Clearinghouse", url: "https://www.nationalstudentclearinghouse.com", category: "Learning", label: "DENIED" },
  { id: "r508", name: "NaturalReader", url: "https://www.naturalreader.com", category: "Language Arts", label: "DENIED" },
  { id: "r509", name: "Naviance", url: "https://www.naviance.com", category: "Career Readiness", label: "DENIED" },
  { id: "r510", name: "NCCER Connect", url: "https://www.nccerconnect.com", category: "Learning", label: "DENIED" },
  { id: "r511", name: "NCH Express Accounts", url: "https://www.nchexpressaccounts.com", category: "Math", label: "DENIED" },
  { id: "r512", name: "Netflix", url: "https://www.netflix.com", category: "Learning", label: "DENIED" },
  { id: "r513", name: "News-o-matic", url: "https://www.news-o-matic.com", category: "Learning", label: "DENIED" },
  { id: "r514", name: "NGPF", url: "https://www.ngpf.com", category: "Learning", label: "DENIED" },
  { id: "r515", name: "Nintendo Switch Online", url: "https://www.nintendoswitchonline.com", category: "Learning", label: "DENIED" },
  { id: "r516", name: "Nitro Type", url: "https://www.nitrotype.com", category: "Games", label: "DENIED" },
  { id: "r517", name: "NNAT3", url: "https://www.nnat3.com", category: "Assessment", label: "DENIED" },
  { id: "r518", name: "NOCTI", url: "https://www.nocti.com", category: "Assessment", label: "DENIED" },
  { id: "r519", name: "Notepad ++", url: "https://www.notepad.com", category: "Learning", label: "DENIED" },
  { id: "r520", name: "NRICH", url: "https://www.nrich.com", category: "Learning", label: "DENIED" },
  { id: "r521", name: "Nucleus Smart App", url: "https://www.nucleussmartapp.com", category: "Art", label: "DENIED" },
  { id: "r522", name: "NV Access/NVDA", url: "https://www.nvaccessnvda.com", category: "Learning", label: "DENIED" },
  { id: "r523", name: "O.W.L. Educational Services", url: "https://www.owleducationalservices.com", category: "Learning", label: "DENIED" },
  { id: "r524", name: "ObjectiveEd", url: "https://www.objectiveed.com", category: "Art", label: "DENIED" },
  { id: "r525", name: "OBS: Open Broadcaster Software", url: "https://www.obsopenbroadcastersoftware.com", category: "Learning", label: "DENIED" },
  { id: "r526", name: "Oculus", url: "https://www.oculus.com", category: "Learning", label: "DENIED" },
  { id: "r527", name: "OneCompiler", url: "https://www.onecompiler.com", category: "Learning", label: "DENIED" },
  { id: "r528", name: "OnShape", url: "https://www.onshape.com", category: "Learning", label: "DENIED" },
  { id: "r529", name: "OpenStax", url: "https://www.openstax.com", category: "Learning", label: "DENIED" },
  { id: "r530", name: "Originality.AI", url: "https://www.originalityai.com", category: "Learning", label: "DENIED" },
  { id: "r531", name: "Otter.ai", url: "https://otter.ai", category: "Learning", label: "DENIED" },
  { id: "r532", name: "Page Marker Chrome Extension", url: "https://www.pagemarkerchromeextension.com", category: "Learning", label: "DENIED" },
  { id: "r533", name: "Panorama Education", url: "https://www.panoramaeducation.com", category: "Learning", label: "DENIED" },
  { id: "r534", name: "PaperAirplanes HQ", url: "https://www.paperairplaneshq.com", category: "Learning", label: "DENIED" },
  { id: "r535", name: "PARiConnect", url: "https://www.pariconnect.com", category: "Learning", label: "DENIED" },
  { id: "r536", name: "PASS Software from PRC", url: "https://www.passsoftwarefromprc.com", category: "Learning", label: "DENIED" },
  { id: "r537", name: "Passwordstate", url: "https://www.passwordstate.com", category: "Language Arts", label: "DENIED" },
  { id: "r538", name: "Pavlovia", url: "https://www.pavlovia.com", category: "Learning", label: "DENIED" },
  { id: "r539", name: "Paws in Jobland", url: "https://www.pawsinjobland.com", category: "Career Readiness", label: "DENIED" },
  { id: "r540", name: "PBS Kids", url: "https://pbskids.org", category: "Learning", label: "DENIED" },
  { id: "r541", name: "Pear Deck", url: "https://www.peardeck.com", category: "Learning", label: "DENIED" },
  { id: "r542", name: "Peergrade", url: "https://www.peergrade.com", category: "Assessment", label: "DENIED" },
  { id: "r543", name: "Perennial Math", url: "https://www.perennialmath.com", category: "Math", label: "DENIED" },
  { id: "r544", name: "Personal Finance Lab", url: "https://www.personalfinancelab.com", category: "Science", label: "DENIED" },
  { id: "r545", name: "Perusall", url: "https://www.perusall.com", category: "Learning", label: "DENIED" },
  { id: "r546", name: "Phonics Island", url: "https://www.phonicsisland.com", category: "Language Arts", label: "DENIED" },
  { id: "r547", name: "PhotoCircle", url: "https://www.photocircle.com", category: "Art", label: "DENIED" },
  { id: "r548", name: "Photospeak", url: "https://www.photospeak.com", category: "Art", label: "DENIED" },
  { id: "r549", name: "Piazza", url: "https://www.piazza.com", category: "Learning", label: "DENIED" },
  { id: "r550", name: "PicCollage", url: "https://www.piccollage.com", category: "Learning", label: "DENIED" },
  { id: "r551", name: "Piktochart", url: "https://www.piktochart.com", category: "Art", label: "DENIED" },
  { id: "r552", name: "Pink Cat Games", url: "https://www.pinkcatgames.com", category: "Games", label: "DENIED" },
  { id: "r553", name: "Pinterest", url: "https://www.pinterest.com", category: "Learning", label: "DENIED" },
  { id: "r554", name: "Pixabay.com", url: "https://www.pixabaycom.com", category: "Learning", label: "DENIED" },
  { id: "r555", name: "Plants vs. Zombies 2", url: "https://www.plantsvszombies2.com", category: "Science", label: "DENIED" },
  { id: "r556", name: "Plants vs. Zombies HD", url: "https://www.plantsvszombieshd.com", category: "Science", label: "DENIED" },
  { id: "r557", name: "PLTW", url: "https://www.pltw.com", category: "Learning", label: "DENIED" },
  { id: "r558", name: "Poll Everywhere", url: "https://www.polleverywhere.com", category: "Learning", label: "DENIED" },
  { id: "r559", name: "PowerSchool Learning", url: "https://www.powerschoollearning.com", category: "LMS", label: "DENIED" },
  { id: "r560", name: "PowerSchool Schoology Learning", url: "https://www.powerschoolschoologylearning.com", category: "LMS", label: "DENIED" },
  { id: "r561", name: "Powtoon", url: "https://www.powtoon.com", category: "Art", label: "DENIED" },
  { id: "r562", name: "PRB", url: "https://www.prb.com", category: "Learning", label: "DENIED" },
  { id: "r563", name: "PreKinders", url: "https://www.prekinders.com", category: "Learning", label: "DENIED" },
  { id: "r564", name: "Prezi", url: "https://prezi.com", category: "Learning", label: "DENIED" },
  { id: "r565", name: "Primary Apps", url: "https://www.primaryapps.com", category: "Learning", label: "DENIED" },
  { id: "r566", name: "Proctorio", url: "https://www.proctorio.com", category: "Assessment", label: "DENIED" },
  { id: "r567", name: "ProgressTrak", url: "https://www.progresstrak.com", category: "Learning", label: "DENIED" },
  { id: "r568", name: "ProKeys extension", url: "https://www.prokeysextension.com", category: "Learning", label: "DENIED" },
  { id: "r569", name: "ProQuest", url: "https://www.proquest.com", category: "Learning", label: "DENIED" },
  { id: "r570", name: "ProSolutions Training", url: "https://www.prosolutionstraining.com", category: "Learning", label: "DENIED" },
  { id: "r571", name: "PuppetPals", url: "https://www.puppetpals.com", category: "Learning", label: "DENIED" },
  { id: "r572", name: "Puzzel.org", url: "https://www.puzzelorg.com", category: "Learning", label: "DENIED" },
  { id: "r573", name: "Puzzle Kids - Jigsaw Puzzles", url: "https://www.puzzlekidsjigsawpuzzles.com", category: "Learning", label: "DENIED" },
  { id: "r574", name: "Puzzle Maker", url: "https://www.puzzlemaker.com", category: "Learning", label: "DENIED" },
  { id: "r575", name: "PyCharm", url: "https://www.jetbrains.com/pycharm", category: "Learning", label: "DENIED" },
  { id: "r576", name: "Python", url: "https://www.python.org", category: "Coding", label: "DENIED" },
  { id: "r577", name: "QR Code Reader app", url: "https://www.qrcodereaderapp.com", category: "Coding", label: "DENIED" },
  { id: "r578", name: "Quia", url: "https://www.quia.com", category: "Learning", label: "DENIED" },
  { id: "r579", name: "QuiverVision", url: "https://www.quivervision.com", category: "Learning", label: "DENIED" },
  { id: "r580", name: "Quizalize", url: "https://www.quizalize.com", category: "Assessment", label: "DENIED" },
  { id: "r581", name: "Quizbot.ai", url: "https://www.quizbotai.com", category: "Assessment", label: "DENIED" },
  { id: "r582", name: "Quizlet", url: "https://quizlet.com", category: "Assessment", label: "DENIED" },
  { id: "r583", name: "Quora", url: "https://www.quora.com", category: "Learning", label: "DENIED" },
  { id: "r584", name: "Read Theory", url: "https://www.readtheory.com", category: "Language Arts", label: "DENIED" },
  { id: "r585", name: "Read Write Think", url: "https://www.readwritethink.com", category: "Language Arts", label: "DENIED" },
  { id: "r586", name: "Reading Rockets", url: "https://www.readingrockets.com", category: "Language Arts", label: "DENIED" },
  { id: "r587", name: "Remind", url: "https://www.remind.com", category: "Productivity", label: "DENIED" },
  { id: "r588", name: "RemNote", url: "https://www.remnote.com", category: "Learning", label: "DENIED" },
  { id: "r589", name: "Renaissance Accelerated Reader", url: "https://www.renaissanceacceleratedreader.com", category: "Language Arts", label: "DENIED" },
  { id: "r590", name: "Renzulli", url: "https://www.renzulli.com", category: "Learning", label: "DENIED" },
  { id: "r591", name: "Replit", url: "https://replit.com", category: "Coding", label: "DENIED" },
  { id: "r592", name: "Respondus", url: "https://www.respondus.com", category: "Assessment", label: "DENIED" },
  { id: "r593", name: "Respondus Lockdown Browser", url: "https://www.responduslockdownbrowser.com", category: "Assessment", label: "DENIED" },
  { id: "r594", name: "Revit", url: "https://www.autodesk.com/products/revit", category: "Art", label: "DENIED" },
  { id: "r595", name: "Riot Games", url: "https://www.riotgames.com", category: "Games", label: "DENIED" },
  { id: "r596", name: "RocketLit", url: "https://www.rocketlit.com", category: "Learning", label: "DENIED" },
  { id: "r597", name: "Rockwell Automation", url: "https://www.rockwellautomation.com", category: "Learning", label: "DENIED" },
  { id: "r598", name: "RoomRecess", url: "https://www.roomrecess.com", category: "Learning", label: "DENIED" },
  { id: "r599", name: "Root Coding", url: "https://www.rootcoding.com", category: "Coding", label: "DENIED" },
  { id: "r600", name: "Rosetta Stone", url: "https://www.rosettastone.com", category: "Music", label: "DENIED" },
  { id: "r601", name: "RoverCraft Racing", url: "https://www.rovercraftracing.com", category: "Games", label: "DENIED" },
  { id: "r602", name: "Runestone Academy", url: "https://www.runestoneacademy.com", category: "Music", label: "DENIED" },
  { id: "r603", name: "SafeShare", url: "https://www.safeshare.com", category: "Learning", label: "DENIED" },
  { id: "r604", name: "San Diego Zoo Live Animal Cameras", url: "https://www.sandiegozooliveanimalcameras.com", category: "Science", label: "DENIED" },
  { id: "r605", name: "Saturn app", url: "https://www.saturnapp.com", category: "Learning", label: "DENIED" },
  { id: "r606", name: "Savvas Interactive Science CC1.2", url: "https://www.savvasinteractivesciencecc12.com", category: "Science", label: "DENIED" },
  { id: "r607", name: "Savvas myPerspectives CC1.2", url: "https://www.savvasmyperspectivescc12.com", category: "Learning", label: "DENIED" },
  { id: "r608", name: "Scholastico", url: "https://www.scholastico.com", category: "Learning", label: "DENIED" },
  { id: "r609", name: "Schoolconomy", url: "https://www.schoolconomy.com", category: "Learning", label: "DENIED" },
  { id: "r610", name: "SchoolStatus", url: "https://www.schoolstatus.com", category: "Learning", label: "DENIED" },
  { id: "r611", name: "Scratch EDU", url: "https://scratch.mit.edu", category: "Coding", label: "DENIED" },
  { id: "r612", name: "Scratch Golf Academy", url: "https://www.scratchgolfacademy.com", category: "Coding", label: "DENIED" },
  { id: "r613", name: "Scratch Jr.", url: "https://www.scratchjr.org", category: "Coding", label: "DENIED" },
  { id: "r614", name: "Screen Recorder", url: "https://www.screenrecorder.com", category: "Art", label: "DENIED" },
  { id: "r615", name: "Scribbr", url: "https://www.scribbr.com", category: "Learning", label: "DENIED" },
  { id: "r616", name: "Scuta", url: "https://www.scuta.com", category: "Learning", label: "DENIED" },
  { id: "r617", name: "SentenceBuilders", url: "https://www.sentencebuilders.com", category: "Learning", label: "DENIED" },
  { id: "r618", name: "Seterra", url: "https://www.seterra.com", category: "Learning", label: "DENIED" },
  { id: "r619", name: "Setgame", url: "https://www.setgame.com", category: "Games", label: "DENIED" },
  { id: "r620", name: "Shapegrams", url: "https://www.shapegrams.com", category: "Learning", label: "DENIED" },
  { id: "r621", name: "Showbie", url: "https://www.showbie.com", category: "Learning", label: "DENIED" },
  { id: "r622", name: "SightWords Pro", url: "https://www.sightwordspro.com", category: "Language Arts", label: "DENIED" },
  { id: "r623", name: "Signup Genius", url: "https://www.signupgenius.com", category: "Learning", label: "DENIED" },
  { id: "r624", name: "Silhouette", url: "https://www.silhouette.com", category: "Learning", label: "DENIED" },
  { id: "r625", name: "Simformotion", url: "https://www.simformotion.com", category: "Productivity", label: "DENIED" },
  { id: "r626", name: "Simpleshow", url: "https://www.simpleshow.com", category: "Learning", label: "DENIED" },
  { id: "r627", name: "Sketchbook", url: "https://www.sketchbook.com", category: "Language Arts", label: "DENIED" },
  { id: "r628", name: "SketchUp Pro 2020", url: "https://www.sketchuppro2020.com", category: "Art", label: "DENIED" },
  { id: "r629", name: "Skills Build", url: "https://www.skillsbuild.com", category: "Learning", label: "DENIED" },
  { id: "r630", name: "Skoolbo", url: "https://www.skoolbo.com", category: "Learning", label: "DENIED" },
  { id: "r631", name: "SkyView Lite", url: "https://www.skyviewlite.com", category: "Learning", label: "DENIED" },
  { id: "r632", name: "Slack", url: "https://slack.com", category: "Productivity", label: "DENIED" },
  { id: "r633", name: "Slice The Price Card", url: "https://www.slicethepricecard.com", category: "Learning", label: "DENIED" },
  { id: "r634", name: "Slides Translator", url: "https://www.slidestranslator.com", category: "Learning", label: "DENIED" },
  { id: "r635", name: "SlidesAI", url: "https://www.slidesai.com", category: "Learning", label: "DENIED" },
  { id: "r636", name: "Slidesgo", url: "https://www.slidesgo.com", category: "Learning", label: "DENIED" },
  { id: "r637", name: "Slido", url: "https://www.slido.com", category: "Learning", label: "DENIED" },
  { id: "r638", name: "SLP Now", url: "https://www.slpnow.com", category: "Learning", label: "DENIED" },
  { id: "r639", name: "SLP Stephen", url: "https://www.slpstephen.com", category: "Learning", label: "DENIED" },
  { id: "r640", name: "SLP Toolkit", url: "https://www.slptoolkit.com", category: "Learning", label: "DENIED" },
  { id: "r641", name: "Smashy Road", url: "https://www.smashyroad.com", category: "Games", label: "DENIED" },
  { id: "r642", name: "Snap Raise", url: "https://www.snapraise.com", category: "Learning", label: "DENIED" },
  { id: "r643", name: "Snap Scene", url: "https://www.snapscene.com", category: "Special Education", label: "DENIED" },
  { id: "r644", name: "Snap!", url: "https://www.snap.com", category: "Learning", label: "DENIED" },
  { id: "r645", name: "Snappet", url: "https://www.snappet.com", category: "Learning", label: "DENIED" },
  { id: "r646", name: "SnapType", url: "https://www.snaptype.com", category: "Learning", label: "DENIED" },
  { id: "r647", name: "SocialBee", url: "https://www.socialbee.com", category: "Learning", label: "DENIED" },
  { id: "r648", name: "Socrative", url: "https://www.socrative.com", category: "Learning", label: "DENIED" },
  { id: "r649", name: "SoftSchools", url: "https://www.softschools.com", category: "Learning", label: "DENIED" },
  { id: "r650", name: "Solidworks", url: "https://www.solidworks.com", category: "Art", label: "DENIED" },
  { id: "r651", name: "Sort It Out 1", url: "https://www.sortitout1.com", category: "Learning", label: "DENIED" },
  { id: "r652", name: "SoundingBoard", url: "https://www.soundingboard.com", category: "Music", label: "DENIED" },
  { id: "r653", name: "SpanishChecker.com", url: "https://www.spanishcheckercom.com", category: "World Languages", label: "DENIED" },
  { id: "r654", name: "SpanishDict", url: "https://www.spanishdict.com", category: "World Languages", label: "DENIED" },
  { id: "r655", name: "SPARKvue", url: "https://www.sparkvue.com", category: "Learning", label: "DENIED" },
  { id: "r656", name: "Sphero", url: "https://www.sphero.com", category: "Learning", label: "DENIED" },
  { id: "r657", name: "SplashLearn", url: "https://www.splashlearn.com", category: "Learning", label: "DENIED" },
  { id: "r658", name: "SpringMath", url: "https://www.springmath.com", category: "Math", label: "DENIED" },
  { id: "r659", name: "Stanford History Education Group", url: "https://www.stanfordhistoryeducationgroup.com", category: "Language Arts", label: "DENIED" },
  { id: "r660", name: "Stash", url: "https://www.stash.com", category: "Learning", label: "DENIED" },
  { id: "r661", name: "Stats Medic", url: "https://www.statsmedic.com", category: "Learning", label: "DENIED" },
  { id: "r662", name: "STEM Resource Finder", url: "https://www.stemresourcefinder.com", category: "Science", label: "DENIED" },
  { id: "r663", name: "Stop Motion Animator", url: "https://www.stopmotionanimator.com", category: "Learning", label: "DENIED" },
  { id: "r664", name: "StoryJumper", url: "https://www.storyjumper.com", category: "Language Arts", label: "DENIED" },
  { id: "r665", name: "Streamster", url: "https://www.streamster.com", category: "Learning", label: "DENIED" },
  { id: "r666", name: "StuDocu", url: "https://www.studocu.com", category: "Learning", label: "DENIED" },
  { id: "r667", name: "Study Spanish", url: "https://www.studyspanish.com", category: "World Languages", label: "DENIED" },
  { id: "r668", name: "StudyFetch", url: "https://www.studyfetch.com", category: "Learning", label: "DENIED" },
  { id: "r669", name: "Subway Surfer", url: "https://www.subwaysurfer.com", category: "Games", label: "DENIED" },
  { id: "r670", name: "Sudoku.com", url: "https://www.sudokucom.com", category: "Learning", label: "DENIED" },
  { id: "r671", name: "Superhero Comic Book Maker", url: "https://www.superherocomicbookmaker.com", category: "Language Arts", label: "DENIED" },
  { id: "r672", name: "Survey Monkey", url: "https://www.surveymonkey.com", category: "Productivity", label: "DENIED" },
  { id: "r673", name: "Sutori", url: "https://www.sutori.com", category: "Learning", label: "DENIED" },
  { id: "r674", name: "Swift Playgrounds", url: "https://www.swiftplaygrounds.com", category: "Coding", label: "DENIED" },
  { id: "r675", name: "SWIS", url: "https://www.swis.com", category: "Learning", label: "DENIED" },
  { id: "r676", name: "Switch Classroom", url: "https://www.switchclassroom.com", category: "LMS", label: "DENIED" },
  { id: "r677", name: "Talk and Comment", url: "https://www.talkandcomment.com", category: "Learning", label: "DENIED" },
  { id: "r678", name: "Tampermonkey", url: "https://www.tampermonkey.com", category: "Learning", label: "DENIED" },
  { id: "r679", name: "TD Snap", url: "https://www.tdsnap.com", category: "Learning", label: "DENIED" },
  { id: "r680", name: "Teach Your Monster to Read", url: "https://www.teachyourmonstertoread.com", category: "Language Arts", label: "DENIED" },
  { id: "r681", name: "Teaching Number Lines", url: "https://www.teachingnumberlines.com", category: "Math", label: "DENIED" },
  { id: "r682", name: "TeachingBooks", url: "https://www.teachingbooks.com", category: "Language Arts", label: "DENIED" },
  { id: "r683", name: "TeachShare Platform", url: "https://www.teachshareplatform.com", category: "Productivity", label: "DENIED" },
  { id: "r684", name: "TeachTown Social Skills", url: "https://www.teachtownsocialskills.com", category: "Learning", label: "DENIED" },
  { id: "r685", name: "TeachVid", url: "https://www.teachvid.com", category: "Learning", label: "DENIED" },
  { id: "r686", name: "Teambuildr", url: "https://www.teambuildr.com", category: "Learning", label: "DENIED" },
  { id: "r687", name: "TED Ed", url: "https://ed.ted.com", category: "Learning", label: "DENIED" },
  { id: "r688", name: "Tello EDU", url: "https://www.telloedu.com", category: "Learning", label: "DENIED" },
  { id: "r689", name: "Texas Instruments", url: "https://www.texasinstruments.com", category: "Music", label: "DENIED" },
  { id: "r690", name: "Textivate", url: "https://www.textivate.com", category: "Language Arts", label: "DENIED" },
  { id: "r691", name: "ThatQuiz", url: "https://www.thatquiz.com", category: "Assessment", label: "DENIED" },
  { id: "r692", name: "The Farmer\'s Almanac", url: "https://www.thefarmersalmanac.com", category: "Learning", label: "DENIED" },
  { id: "r693", name: "The Social Express", url: "https://www.thesocialexpress.com", category: "Learning", label: "DENIED" },
  { id: "r694", name: "The TV Teacher", url: "https://www.thetvteacher.com", category: "Learning", label: "DENIED" },
  { id: "r695", name: "Thesaurus.com", url: "https://www.thesaurus.com", category: "Learning", label: "DENIED" },
  { id: "r696", name: "ThinkIB.net", url: "https://www.thinkibnet.com", category: "Learning", label: "DENIED" },
  { id: "r697", name: "Thinking Blocks Addition", url: "https://www.thinkingblocksaddition.com", category: "Learning", label: "DENIED" },
  { id: "r698", name: "Thinkuknow.co.uk", url: "https://www.thinkuknowcouk.com", category: "Learning", label: "DENIED" },
  { id: "r699", name: "THISSISAND", url: "https://www.thissisand.com", category: "Learning", label: "DENIED" },
  { id: "r700", name: "Thunkable", url: "https://www.thunkable.com", category: "Learning", label: "DENIED" },
  { id: "r701", name: "Tiller", url: "https://www.tiller.com", category: "Learning", label: "DENIED" },
  { id: "r702", name: "Timestables.com", url: "https://www.timestablescom.com", category: "Math", label: "DENIED" },
  { id: "r703", name: "Tiny Tap", url: "https://www.tinytap.com", category: "Learning", label: "DENIED" },
  { id: "r704", name: "TKSST", url: "https://www.tksst.com", category: "Learning", label: "DENIED" },
  { id: "r705", name: "Today\'s Science", url: "https://www.todaysscience.com", category: "Science", label: "DENIED" },
  { id: "r706", name: "TonalEnergy for Education", url: "https://www.tonalenergyforeducation.com", category: "Learning", label: "DENIED" },
  { id: "r707", name: "Toolbox", url: "https://www.toolbox.com", category: "Learning", label: "DENIED" },
  { id: "r708", name: "Toon Boom", url: "https://www.toonboom.com", category: "Art", label: "DENIED" },
  { id: "r709", name: "Topmarks Math", url: "https://www.topmarksmath.com", category: "Math", label: "DENIED" },
  { id: "r710", name: "TouchChat", url: "https://www.touchchat.com", category: "Learning", label: "DENIED" },
  { id: "r711", name: "Tour-Builder app", url: "https://www.tour-builderapp.com", category: "Learning", label: "DENIED" },
  { id: "r712", name: "Toy Theater", url: "https://www.toytheater.com", category: "Learning", label: "DENIED" },
  { id: "r713", name: "Trackwrestling", url: "https://www.trackwrestling.com", category: "Learning", label: "DENIED" },
  { id: "r714", name: "Transfr", url: "https://www.transfr.com", category: "Learning", label: "DENIED" },
  { id: "r715", name: "Trello", url: "https://trello.com", category: "Productivity", label: "DENIED" },
  { id: "r716", name: "Trinket", url: "https://www.trinket.com", category: "Coding", label: "DENIED" },
  { id: "r717", name: "Truth Initiative", url: "https://www.truthinitiative.com", category: "Learning", label: "DENIED" },
  { id: "r718", name: "Tumblebook", url: "https://www.tumblebook.com", category: "Language Arts", label: "DENIED" },
  { id: "r719", name: "Turtlediary", url: "https://www.turtlediary.com", category: "Learning", label: "DENIED" },
  { id: "r720", name: "Twee", url: "https://www.twee.com", category: "Learning", label: "DENIED" },
  { id: "r721", name: "Twinkl", url: "https://www.twinkl.com", category: "Learning", label: "DENIED" },
  { id: "r722", name: "Twitch", url: "https://www.twitch.tv", category: "Learning", label: "DENIED" },
  { id: "r723", name: "Tynker", url: "https://www.tynker.com", category: "Learning", label: "DENIED" },
  { id: "r724", name: "Typesy", url: "https://www.typesy.com", category: "Learning", label: "DENIED" },
  { id: "r725", name: "TypeTastic", url: "https://www.typetastic.com", category: "Learning", label: "DENIED" },
  { id: "r726", name: "Typing Agent", url: "https://www.typingagent.com", category: "Learning", label: "DENIED" },
  { id: "r727", name: "Typing Pal", url: "https://www.typingpal.com", category: "Learning", label: "DENIED" },
  { id: "r728", name: "uCertify COURSE", url: "https://www.ucertifycourse.com", category: "LMS", label: "DENIED" },
  { id: "r729", name: "uCertify LAB", url: "https://www.ucertifylab.com", category: "Science", label: "DENIED" },
  { id: "r730", name: "UGC Esports", url: "https://www.ugcesports.com", category: "Learning", label: "DENIED" },
  { id: "r731", name: "Ultimaker Cura", url: "https://www.ultimakercura.com", category: "Learning", label: "DENIED" },
  { id: "r732", name: "Ultimate Review Packet", url: "https://www.ultimatereviewpacket.com", category: "Learning", label: "DENIED" },
  { id: "r733", name: "Uncrashed: FPV Drone Simulator", url: "https://www.uncrashedfpvdronesimulator.com", category: "Learning", label: "DENIED" },
  { id: "r734", name: "Unity Education", url: "https://www.unityeducation.com", category: "Learning", label: "DENIED" },
  { id: "r735", name: "Unsplash", url: "https://www.unsplash.com", category: "Learning", label: "DENIED" },
  { id: "r736", name: "UP Studio", url: "https://www.upstudio.com", category: "Learning", label: "DENIED" },
  { id: "r737", name: "Vcarve", url: "https://www.vcarve.com", category: "Learning", label: "DENIED" },
  { id: "r738", name: "VEED.IO", url: "https://www.veedio.com", category: "Art", label: "DENIED" },
  { id: "r739", name: "VelociDrone", url: "https://www.velocidrone.com", category: "Learning", label: "DENIED" },
  { id: "r740", name: "Venture Valley", url: "https://www.venturevalley.com", category: "Learning", label: "DENIED" },
  { id: "r741", name: "Vernier Graphical Analysis", url: "https://www.verniergraphicalanalysis.com", category: "Science", label: "DENIED" },
  { id: "r742", name: "Vimeo", url: "https://vimeo.com", category: "Learning", label: "DENIED" },
  { id: "r743", name: "Virginia Career VIEW", url: "https://www.virginiacareerview.com", category: "Career Readiness", label: "DENIED" },
  { id: "r744", name: "Virtual Business", url: "https://www.virtualbusiness.com", category: "Career Readiness", label: "DENIED" },
  { id: "r745", name: "Virtual Math Academy", url: "https://www.virtualmathacademy.com", category: "Math", label: "DENIED" },
  { id: "r746", name: "Visual Countdown Timer", url: "https://www.visualcountdowntimer.com", category: "Math", label: "DENIED" },
  { id: "r747", name: "Visual Fractions", url: "https://www.visualfractions.com", category: "Math", label: "DENIED" },
  { id: "r748", name: "VLS Laser Interface", url: "https://www.vlslaserinterface.com", category: "Learning", label: "DENIED" },
  { id: "r749", name: "Vocabulary.com", url: "https://www.vocabularycom.com", category: "Language Arts", label: "DENIED" },
  { id: "r750", name: "Vocaroo", url: "https://www.vocaroo.com", category: "Learning", label: "DENIED" },
  { id: "r751", name: "Voice Dream", url: "https://www.voicedream.com", category: "Special Education", label: "DENIED" },
  { id: "r752", name: "Voice Recorder", url: "https://www.voicerecorder.com", category: "Learning", label: "DENIED" },
  { id: "r753", name: "VoiceThread", url: "https://www.voicethread.com", category: "Language Arts", label: "DENIED" },
  { id: "r754", name: "Vooks", url: "https://www.vooks.com", category: "Learning", label: "DENIED" },
  { id: "r755", name: "Voyager Sopris Learning", url: "https://www.voyagersoprislearning.com", category: "Learning", label: "DENIED" },
  { id: "r756", name: "VSDC - Video Editor", url: "https://www.vsdcvideoeditor.com", category: "Art", label: "DENIED" },
  { id: "r757", name: "Vyond", url: "https://www.vyond.com", category: "Art", label: "DENIED" },
  { id: "r758", name: "W3schools.com", url: "https://www.w3schools.com", category: "Learning", label: "DENIED" },
  { id: "r759", name: "Wakelet for Education", url: "https://www.wakeletforeducation.com", category: "Learning", label: "DENIED" },
  { id: "r760", name: "Wayside Publishing Chiarissimo", url: "https://www.waysidepublishingchiarissimo.com", category: "Learning", label: "DENIED" },
  { id: "r761", name: "Wayside Publishing EntreCulturas", url: "https://www.waysidepublishingentreculturas.com", category: "Learning", label: "DENIED" },
  { id: "r762", name: "Wayside Publishing EntreCultures", url: "https://www.waysidepublishingentrecultures.com", category: "Learning", label: "DENIED" },
  { id: "r763", name: "Wayside Publishing Scandite", url: "https://www.waysidepublishingscandite.com", category: "Learning", label: "DENIED" },
  { id: "r764", name: "Wayside Publishing Tejidos", url: "https://www.waysidepublishingtejidos.com", category: "Learning", label: "DENIED" },
  { id: "r765", name: "WeatherBug", url: "https://www.weatherbug.com", category: "Learning", label: "DENIED" },
  { id: "r766", name: "WeDo 2.0 Lego", url: "https://www.wedo20lego.com", category: "Learning", label: "DENIED" },
  { id: "r767", name: "Weebly", url: "https://www.weebly.com", category: "Learning", label: "DENIED" },
  { id: "r768", name: "West Point Bridge Designer", url: "https://www.westpointbridgedesigner.com", category: "Art", label: "DENIED" },
  { id: "r769", name: "WeWillWrite", url: "https://www.wewillwrite.com", category: "Learning", label: "DENIED" },
  { id: "r770", name: "Wheel Of Names", url: "https://www.wheelofnames.com", category: "Learning", label: "DENIED" },
  { id: "r771", name: "Wheels on the Bus", url: "https://www.wheelsonthebus.com", category: "Learning", label: "DENIED" },
  { id: "r772", name: "Whiteboard.chat", url: "https://www.whiteboardchat.com", category: "Learning", label: "DENIED" },
  { id: "r773", name: "Whiteboard.fi", url: "https://www.whiteboardfi.com", category: "Learning", label: "DENIED" },
  { id: "r774", name: "Wirecast", url: "https://www.wirecast.com", category: "Learning", label: "DENIED" },
  { id: "r775", name: "Wix.com", url: "https://www.wix.com", category: "Learning", label: "DENIED" },
  { id: "r776", name: "Wizerme", url: "https://www.wizerme.com", category: "Learning", label: "DENIED" },
  { id: "r777", name: "Wonderopolis", url: "https://www.wonderopolis.com", category: "Learning", label: "DENIED" },
  { id: "r778", name: "Wonster Words: ABC Phonics", url: "https://www.wonsterwordsabcphonics.com", category: "Language Arts", label: "DENIED" },
  { id: "r779", name: "Word Club Spelling+Vocabulary", url: "https://www.wordclubspellingvocabulary.com", category: "Language Arts", label: "DENIED" },
  { id: "r780", name: "Word Vault", url: "https://www.wordvault.com", category: "Language Arts", label: "DENIED" },
  { id: "r781", name: "Wordart", url: "https://www.wordart.com", category: "Language Arts", label: "DENIED" },
  { id: "r782", name: "WordBrain", url: "https://www.wordbrain.com", category: "Language Arts", label: "DENIED" },
  { id: "r783", name: "Wordreference.com", url: "https://www.wordreference.com", category: "Language Arts", label: "DENIED" },
  { id: "r784", name: "WordTag", url: "https://www.wordtag.com", category: "Language Arts", label: "DENIED" },
  { id: "r785", name: "WordTap", url: "https://www.wordtap.com", category: "Language Arts", label: "DENIED" },
  { id: "r786", name: "Wordwall", url: "https://www.wordwall.com", category: "Language Arts", label: "DENIED" },
  { id: "r787", name: "World Book Online", url: "https://www.worldbookonline.com", category: "Language Arts", label: "DENIED" },
  { id: "r788", name: "World History Encyclopedia", url: "https://www.worldhistoryencyclopedia.com", category: "Language Arts", label: "DENIED" },
  { id: "r789", name: "Worldwildlife.org", url: "https://www.worldwildlifeorg.com", category: "Social Studies", label: "DENIED" },
  { id: "r790", name: "Writable", url: "https://www.writable.com", category: "Learning", label: "DENIED" },
  { id: "r791", name: "www.houstonzoo.org", url: "https://www.houstonzoo.org", category: "Learning", label: "DENIED" },
  { id: "r792", name: "Xello", url: "https://www.xello.com", category: "Career Readiness", label: "DENIED" },
  { id: "r793", name: "XTool", url: "https://www.xtool.com", category: "Learning", label: "DENIED" },
  { id: "r794", name: "XTool Creative Space (XCS)", url: "https://www.xtoolcreativespacexcs.com", category: "Science", label: "DENIED" },
  { id: "r795", name: "Yes/No", url: "https://www.yesno.com", category: "Learning", label: "DENIED" },
  { id: "r796", name: "YouScience", url: "https://www.youscience.com", category: "Science", label: "DENIED" },
  { id: "r797", name: "YouTube", url: "https://www.youtube.com", category: "Learning", label: "DENIED" },
  { id: "r798", name: "YouTube Kids", url: "https://www.youtubekids.com", category: "Learning", label: "DENIED" },
  { id: "r799", name: "Zipgrade.com", url: "https://www.zipgrade.com", category: "Assessment", label: "DENIED" },
  { id: "r800", name: "Ziplet", url: "https://www.ziplet.com", category: "Learning", label: "DENIED" },
  { id: "r801", name: "Zoho Show", url: "https://www.zohoshow.com", category: "Learning", label: "DENIED" },
  { id: "r802", name: "A Plus Math", url: "https://www.aplusmath.com", category: "Math", label: "STAFF USE ONLY" },
  { id: "r803", name: "American Red Cross", url: "https://www.americanredcross.com", category: "Learning", label: "STAFF USE ONLY" },
  { id: "r804", name: "AMNH.org", url: "https://www.amnh.org", category: "Science", label: "STAFF USE ONLY" },
  { id: "r805", name: "AP Central", url: "https://www.apcentral.com", category: "Learning", label: "STAFF USE ONLY" },
  { id: "r806", name: "Art For Kids Hub", url: "https://www.artforkidshub.com", category: "Art", label: "STAFF USE ONLY" },
  { id: "r807", name: "Awesome Screenshot", url: "https://www.awesomescreenshot.com", category: "Learning", label: "STAFF USE ONLY" },
  { id: "r808", name: "Be Good People Curriculum", url: "https://www.begoodpeoplecurriculum.com", category: "Teacher Resources", label: "STAFF USE ONLY" },
  { id: "r809", name: "BioInteractive", url: "https://www.biointeractive.com", category: "Science", label: "STAFF USE ONLY" },
  { id: "r810", name: "Bitesize", url: "https://www.bbc.co.uk/bitesize", category: "Learning", label: "STAFF USE ONLY" },
  { id: "r811", name: "BogglesWorld ESL", url: "https://www.bogglesworldesl.com", category: "Language Arts", label: "STAFF USE ONLY" },
  { id: "r812", name: "Bookworms K-5", url: "https://www.bookwormsk-5.com", category: "Language Arts", label: "STAFF USE ONLY" },
  { id: "r813", name: "Boom Cards", url: "https://www.boomcards.com", category: "Learning", label: "STAFF USE ONLY" },
  { id: "r814", name: "CAD & SnapCad", url: "https://www.cadsnapcad.com", category: "Coding", label: "STAFF USE ONLY" },
  { id: "r815", name: "ChatGPT", url: "https://chatgpt.com", category: "AI Tools", label: "STAFF USE ONLY" },
  { id: "r816", name: "Choral Tracks", url: "https://www.choraltracks.com", category: "Music", label: "STAFF USE ONLY" },
  { id: "r817", name: "CNN 10", url: "https://www.cnn.com/cnn10", category: "Learning", label: "STAFF USE ONLY" },
  { id: "r818", name: "Common Sense Education", url: "https://www.commonsenseeducation.com", category: "Teacher Resources", label: "STAFF USE ONLY" },
  { id: "r819", name: "Commonsense Media", url: "https://www.commonsensemedia.com", category: "Teacher Resources", label: "STAFF USE ONLY" },
  { id: "r820", name: "Dexcom Follow", url: "https://www.dexcomfollow.com", category: "Special Education", label: "STAFF USE ONLY" },
  { id: "r821", name: "Eduaide.Ai", url: "https://www.eduaide.ai", category: "AI Tools", label: "STAFF USE ONLY" },
  { id: "r822", name: "ETCnomad", url: "https://www.etcnomad.com", category: "Learning", label: "STAFF USE ONLY" },
  { id: "r823", name: "Explore.org Livecams", url: "https://www.exploreorglivecams.com", category: "Learning", label: "STAFF USE ONLY" },
  { id: "r824", name: "FIRST", url: "https://www.first.com", category: "Learning", label: "STAFF USE ONLY" },
  { id: "r825", name: "First Class School Tours", url: "https://www.firstclassschooltours.com", category: "Career Readiness", label: "STAFF USE ONLY" },
  { id: "r826", name: "Flex Curriculum", url: "https://www.flexcurriculum.com", category: "Teacher Resources", label: "STAFF USE ONLY" },
  { id: "r827", name: "Flippity", url: "https://www.flippity.com", category: "Learning", label: "STAFF USE ONLY" },
  { id: "r828", name: "Florida Center for Reading Research", url: "https://www.floridacenterforreadingresearch.com", category: "Language Arts", label: "STAFF USE ONLY" },
  { id: "r829", name: "forScore", url: "https://www.forscore.com", category: "Music", label: "STAFF USE ONLY" },
  { id: "r830", name: "Gibbs-Smith", url: "https://www.gibbs-smith.com", category: "Learning", label: "STAFF USE ONLY" },
  { id: "r831", name: "Goodnotes", url: "https://www.goodnotes.com", category: "Art", label: "STAFF USE ONLY" },
  { id: "r832", name: "Google AI Studio", url: "https://aistudio.google.com", category: "AI Tools", label: "STAFF USE ONLY" },
  { id: "r833", name: "Google Maps", url: "https://maps.google.com", category: "Social Studies", label: "STAFF USE ONLY" },
  { id: "r834", name: "Google Translate", url: "https://translate.google.com", category: "World Languages", label: "STAFF USE ONLY" },
  { id: "r835", name: "GPB KIDS", url: "https://www.gpb.org/kids", category: "Learning", label: "STAFF USE ONLY" },
  { id: "r836", name: "GPB TV", url: "https://www.gpb.org/tv", category: "Learning", label: "STAFF USE ONLY" },
  { id: "r837", name: "Heggerty.org", url: "https://www.heggerty.org", category: "Language Arts", label: "STAFF USE ONLY" },
  { id: "r838", name: "I\'m a Puzzle", url: "https://www.imapuzzle.com", category: "Learning", label: "STAFF USE ONLY" },
  { id: "r839", name: "ITEEA Safety", url: "https://www.iteeasafety.com", category: "Learning", label: "STAFF USE ONLY" },
  { id: "r840", name: "Jigsaw Explorer", url: "https://www.jigsawexplorer.com", category: "Learning", label: "STAFF USE ONLY" },
  { id: "r841", name: "JW Pepper", url: "https://www.jwpepper.com", category: "Music", label: "STAFF USE ONLY" },
  { id: "r842", name: "KickUp", url: "https://www.kickup.com", category: "Career Readiness", label: "STAFF USE ONLY" },
  { id: "r843", name: "Kid Power", url: "https://www.kidpower.com", category: "Learning", label: "STAFF USE ONLY" },
  { id: "r844", name: "Kuta Software", url: "https://www.kutasoftware.com", category: "Math", label: "STAFF USE ONLY" },
  { id: "r845", name: "Learn.Genetics", url: "https://learn.genetics.utah.edu", category: "Science", label: "STAFF USE ONLY" },
  { id: "r846", name: "LilyAssist AI Report Writer", url: "https://www.lilyassistaireportwriter.com", category: "AI Tools", label: "STAFF USE ONLY" },
  { id: "r847", name: "Lizard Point", url: "https://www.lizardpoint.com", category: "Social Studies", label: "STAFF USE ONLY" },
  { id: "r848", name: "MagicSchool", url: "https://www.magicschool.ai", category: "AI Tools", label: "STAFF USE ONLY" },
  { id: "r849", name: "Marker", url: "https://www.marker.com", category: "Art", label: "STAFF USE ONLY" },
  { id: "r850", name: "Math U See", url: "https://www.mathusee.com", category: "Math", label: "STAFF USE ONLY" },
  { id: "r851", name: "Mathigon", url: "https://www.mathigon.com", category: "Math", label: "STAFF USE ONLY" },
  { id: "r852", name: "Matific", url: "https://www.matific.com", category: "Math", label: "STAFF USE ONLY" },
  { id: "r853", name: "Mote Extension", url: "https://www.moteextension.com", category: "Learning", label: "STAFF USE ONLY" },
  { id: "r854", name: "Motorola Solutions - Evidence Library", url: "https://www.motorolasolutionsevidencelibrary.com", category: "Learning", label: "STAFF USE ONLY" },
  { id: "r855", name: "MTI Player", url: "https://www.mtiplayer.com", category: "Music", label: "STAFF USE ONLY" },
  { id: "r856", name: "MTI RehearScore", url: "https://www.mtirehearscore.com", category: "Music", label: "STAFF USE ONLY" },
  { id: "r857", name: "Multi Health Systems", url: "https://www.multihealthsystems.com", category: "Science", label: "STAFF USE ONLY" },
  { id: "r858", name: "myHRC", url: "https://www.myhrc.com", category: "Learning", label: "STAFF USE ONLY" },
  { id: "r859", name: "N2Y", url: "https://www.n2y.com", category: "Special Education", label: "STAFF USE ONLY" },
  { id: "r860", name: "NASA", url: "https://www.nasa.gov", category: "Science", label: "STAFF USE ONLY" },
  { id: "r861", name: "Noteflight Learn", url: "https://www.noteflightlearn.com", category: "Music", label: "STAFF USE ONLY" },
  { id: "r862", name: "NSTA", url: "https://www.nsta.com", category: "Learning", label: "STAFF USE ONLY" },
  { id: "r863", name: "OER Project", url: "https://www.oerproject.com", category: "Social Studies", label: "STAFF USE ONLY" },
  { id: "r864", name: "PandaDoc", url: "https://www.pandadoc.com", category: "Learning", label: "STAFF USE ONLY" },
  { id: "r865", name: "Perplexity AI", url: "https://www.perplexity.ai", category: "AI Tools", label: "STAFF USE ONLY" },
  { id: "r866", name: "PhET Interactive Simulations", url: "https://phet.colorado.edu", category: "Science", label: "STAFF USE ONLY" },
  { id: "r867", name: "Piascore", url: "https://www.piascore.com", category: "Music", label: "STAFF USE ONLY" },
  { id: "r868", name: "Plickers", url: "https://www.plickers.com", category: "Assessment", label: "STAFF USE ONLY" },
  { id: "r869", name: "Polypad", url: "https://www.polypad.com", category: "Math", label: "STAFF USE ONLY" },
  { id: "r870", name: "Procreate", url: "https://procreate.com", category: "Art", label: "STAFF USE ONLY" },
  { id: "r871", name: "QLab", url: "https://www.qlab.com", category: "Science", label: "STAFF USE ONLY" },
  { id: "r872", name: "QLab Remote", url: "https://www.qlabremote.com", category: "Science", label: "STAFF USE ONLY" },
  { id: "r873", name: "QuestionWell", url: "https://www.questionwell.com", category: "Assessment", label: "STAFF USE ONLY" },
  { id: "r874", name: "Readtopia", url: "https://www.readtopia.com", category: "Language Arts", label: "STAFF USE ONLY" },
  { id: "r875", name: "Riverside Score", url: "https://www.riversidescore.com", category: "Assessment", label: "STAFF USE ONLY" },
  { id: "r876", name: "Sage AI", url: "https://www.sageai.com", category: "AI Tools", label: "STAFF USE ONLY" },
  { id: "r877", name: "SchoolAI", url: "https://schoolai.com", category: "AI Tools", label: "STAFF USE ONLY" },
  { id: "r878", name: "Scripps National Spelling Bee", url: "https://www.scrippsnationalspellingbee.com", category: "Language Arts", label: "STAFF USE ONLY" },
  { id: "r879", name: "ShowReady", url: "https://www.showready.com", category: "Language Arts", label: "STAFF USE ONLY" },
  { id: "r880", name: "Smithsonian", url: "https://www.si.edu", category: "Social Studies", label: "STAFF USE ONLY" },
  { id: "r881", name: "SolveMe Puzzles", url: "https://www.solvemepuzzles.com", category: "Math", label: "STAFF USE ONLY" },
  { id: "r882", name: "Soundboard Studio", url: "https://www.soundboardstudio.com", category: "Music", label: "STAFF USE ONLY" },
  { id: "r883", name: "StageTracks", url: "https://www.stagetracks.com", category: "Music", label: "STAFF USE ONLY" },
  { id: "r884", name: "Storyline Online", url: "https://www.storylineonline.net", category: "Language Arts", label: "STAFF USE ONLY" },
  { id: "r885", name: "Swank", url: "https://www.swank.com", category: "Theatre", label: "STAFF USE ONLY" },
  { id: "r886", name: "Teach.Genetics", url: "https://teach.genetics.utah.edu", category: "Science", label: "STAFF USE ONLY" },
  { id: "r887", name: "Teachers Pay Teachers", url: "https://www.teacherspayteachers.com", category: "Teacher Resources", label: "STAFF USE ONLY" },
  { id: "r888", name: "Theatrical Rights Worldwide", url: "https://www.theatricalrightsworldwide.com", category: "Social Studies", label: "STAFF USE ONLY" },
  { id: "r889", name: "Total Registration", url: "https://www.totalregistration.com", category: "Career Readiness", label: "STAFF USE ONLY" },
  { id: "r890", name: "UFLI Resource Hub", url: "https://www.ufliresourcehub.com", category: "Language Arts", label: "STAFF USE ONLY" },
  { id: "r891", name: "Unique Learning System", url: "https://www.uniquelearningsystem.com", category: "Science", label: "STAFF USE ONLY" },
  { id: "r892", name: "VEX V5 Kits", url: "https://www.vexv5kits.com", category: "Coding", label: "STAFF USE ONLY" },
  { id: "r893", name: "VEXcode", url: "https://www.vexcode.com", category: "Coding", label: "STAFF USE ONLY" },
  { id: "r894", name: "VEXcode IQ App", url: "https://www.vexcodeiqapp.com", category: "Coding", label: "STAFF USE ONLY" },
  { id: "r895", name: "VEXcode VR", url: "https://www.vexcodevr.com", category: "Coding", label: "STAFF USE ONLY" },
  { id: "r896", name: "vFairs", url: "https://www.vfairs.com", category: "Career Readiness", label: "STAFF USE ONLY" },
  { id: "r897", name: "vFlat", url: "https://www.vflat.com", category: "Learning", label: "STAFF USE ONLY" },
  { id: "r898", name: "Weather Wiz Kids", url: "https://www.weatherwizkids.com", category: "Science", label: "STAFF USE ONLY" },
  { id: "r899", name: "Wilson Reading System", url: "https://www.wilsonreadingsystem.com", category: "Language Arts", label: "STAFF USE ONLY" },
  { id: "r900", name: "World from A to Z", url: "https://www.worldfromatoz.com", category: "Social Studies", label: "STAFF USE ONLY" },
  { id: "r901", name: "WPS Online Evaluation System", url: "https://www.wpsonlineevaluationsystem.com", category: "Science", label: "STAFF USE ONLY" },
  { id: "r902", name: "X AIR app", url: "https://www.xairapp.com", category: "AI Tools", label: "STAFF USE ONLY" },
  { id: "r903", name: "You Can Fly", url: "https://www.youcanfly.com", category: "Learning", label: "STAFF USE ONLY" },
  { id: "r904", name: "Zambombazo", url: "https://www.zambombazo.com", category: "World Languages", label: "STAFF USE ONLY" },
  { id: "r905", name: "Zoo Atlanta", url: "https://zooatlanta.org", category: "Science", label: "STAFF USE ONLY" },
  { id: "r906", name: "Zoom", url: "https://zoom.us", category: "Productivity", label: "STAFF USE ONLY" },
  { id: "r907", name: "123 Genius", url: "https://www.123genius.com", category: "Learning", label: "APPROVED" },
  { id: "r908", name: "ABC Genius", url: "https://www.abcgenius.com", category: "Learning", label: "APPROVED" },
  { id: "r909", name: "Achieve", url: "https://www.achieve.com", category: "Learning", label: "APPROVED" },
  { id: "r910", name: "Albert", url: "https://www.albert.com", category: "Learning", label: "APPROVED" },
  { id: "r911", name: "Amatrol", url: "https://www.amatrol.com", category: "Career Readiness", label: "APPROVED" },
  { id: "r912", name: "AngelTrax", url: "https://www.angeltrax.com", category: "Learning", label: "APPROVED" },
  { id: "r913", name: "Art of Problem Solving Online", url: "https://www.artofproblemsolvingonline.com", category: "Math", label: "APPROVED" },
  { id: "r914", name: "Ascend Math", url: "https://www.ascendmath.com", category: "Math", label: "APPROVED" },
  { id: "r915", name: "Audacity", url: "https://www.audacityteam.org", category: "Learning", label: "APPROVED" },
  { id: "r916", name: "Avant STAMP", url: "https://www.avantstamp.com", category: "Assessment", label: "APPROVED" },
  { id: "r917", name: "Axiom Learning", url: "https://www.axiomlearning.com", category: "Learning", label: "APPROVED" },
  { id: "r918", name: "Bablingua", url: "https://www.bablingua.com", category: "World Languages", label: "APPROVED" },
  { id: "r919", name: "Banzai", url: "https://www.banzai.com", category: "Career Readiness", label: "APPROVED" },
  { id: "r920", name: "BeanStack", url: "https://www.beanstack.com", category: "Language Arts", label: "APPROVED" },
  { id: "r921", name: "Beast Academy", url: "https://www.beastacademy.com", category: "Math", label: "APPROVED" },
  { id: "r922", name: "Behavior Intervention & Restorative Practices", url: "https://www.behaviorinterventionrestorativepractices.com", category: "Learning", label: "APPROVED" },
  { id: "r923", name: "Bill of Rights Institute", url: "https://billofrightsinstitute.org", category: "Social Studies", label: "APPROVED" },
  { id: "r924", name: "Blender", url: "https://www.blender.org", category: "Coding", label: "APPROVED" },
  { id: "r925", name: "Blockly", url: "https://developers.google.com/blockly", category: "Coding", label: "APPROVED" },
  { id: "r926", name: "Blockly for Dash & Dot robots", url: "https://www.blocklyfordashdotrobots.com", category: "Coding", label: "APPROVED" },
  { id: "r927", name: "Blockly Xylo", url: "https://www.blocklyxylo.com", category: "Coding", label: "APPROVED" },
  { id: "r928", name: "Blocksi", url: "https://www.blocksi.com", category: "Learning", label: "APPROVED" },
  { id: "r929", name: "Blooket", url: "https://www.blooket.com", category: "Assessment", label: "APPROVED" },
  { id: "r930", name: "Britannica Kids", url: "https://kids.britannica.com", category: "Learning", label: "APPROVED" },
  { id: "r931", name: "Business Associate Exam", url: "https://www.businessassociateexam.com", category: "Career Readiness", label: "APPROVED" },
  { id: "r932", name: "ChatEditor", url: "https://www.chateditor.com", category: "Learning", label: "APPROVED" },
  { id: "r933", name: "Choosing The Best (Online)", url: "https://www.choosingthebestonline.com", category: "Learning", label: "APPROVED" },
  { id: "r934", name: "CIW Certifications", url: "https://www.ciwcertifications.com", category: "Career Readiness", label: "APPROVED" },
  { id: "r935", name: "Clairmont Press", url: "https://www.clairmontpress.com", category: "AI Tools", label: "APPROVED" },
  { id: "r936", name: "ClassVR", url: "https://www.classvr.com", category: "Learning", label: "APPROVED" },
  { id: "r937", name: "Clear Touch Command", url: "https://www.cleartouchcommand.com", category: "Learning", label: "APPROVED" },
  { id: "r938", name: "Clicker Writer", url: "https://www.clickerwriter.com", category: "Language Arts", label: "APPROVED" },
  { id: "r939", name: "Clipchamp", url: "https://clipchamp.com", category: "Art", label: "APPROVED" },
  { id: "r940", name: "Co:Writer", url: "https://www.cowriter.com", category: "Language Arts", label: "APPROVED" },
  { id: "r941", name: "CodeHS", url: "https://www.codehs.com", category: "Coding", label: "APPROVED" },
  { id: "r942", name: "CommonLit", url: "https://www.commonlit.org", category: "Language Arts", label: "APPROVED" },
  { id: "r943", name: "Competition University (CU)", url: "https://www.competitionuniversitycu.com", category: "Career Readiness", label: "APPROVED" },
  { id: "r944", name: "Conjuguemos", url: "https://www.conjuguemos.com", category: "World Languages", label: "APPROVED" },
  { id: "r945", name: "Cue", url: "https://www.cue.com", category: "Coding", label: "APPROVED" },
  { id: "r946", name: "Curipod", url: "https://www.curipod.com", category: "Learning", label: "APPROVED" },
  { id: "r947", name: "Cursive Writing Wizard", url: "https://www.cursivewritingwizard.com", category: "Language Arts", label: "APPROVED" },
  { id: "r948", name: "CutTime", url: "https://www.cuttime.com", category: "Music", label: "APPROVED" },
  { id: "r949", name: "DBQ Online", url: "https://www.dbqonline.com", category: "Social Studies", label: "APPROVED" },
  { id: "r950", name: "Derivita", url: "https://www.derivita.com", category: "Math", label: "APPROVED" },
  { id: "r951", name: "Didax", url: "https://www.didax.com", category: "Learning", label: "APPROVED" },
  { id: "r952", name: "Dragonfly", url: "https://www.dragonfly.com", category: "Learning", label: "APPROVED" },
  { id: "r953", name: "Draw with Stars", url: "https://www.drawwithstars.com", category: "Art", label: "APPROVED" },
  { id: "r954", name: "Dremel", url: "https://www.dremel.com", category: "Coding", label: "APPROVED" },
  { id: "r955", name: "DT Trainer", url: "https://www.dttrainer.com", category: "Special Education", label: "APPROVED" },
  { id: "r956", name: "Eduverse", url: "https://www.eduverse.com", category: "Learning", label: "APPROVED" },
  { id: "r957", name: "Empower", url: "https://www.empower.com", category: "Learning", label: "APPROVED" },
  { id: "r958", name: "Eureka Math", url: "https://greatminds.org/math", category: "Math", label: "APPROVED" },
  { id: "r959", name: "Everfi", url: "https://everfi.com", category: "Career Readiness", label: "APPROVED" },
  { id: "r960", name: "ExploreLearning Gizmos", url: "https://www.explorelearninggizmos.com", category: "Science", label: "APPROVED" },
  { id: "r961", name: "Finger Paint with Sounds", url: "https://www.fingerpaintwithsounds.com", category: "Music", label: "APPROVED" },
  { id: "r962", name: "Flashlight360", url: "https://www.flashlight360.com", category: "Assessment", label: "APPROVED" },
  { id: "r963", name: "Formative", url: "https://www.formative.com", category: "Assessment", label: "APPROVED" },
  { id: "r964", name: "Forsyth County Public Library", url: "https://www.forsythpl.org", category: "Learning", label: "APPROVED" },
  { id: "r965", name: "GarageBand", url: "https://www.apple.com/mac/garageband", category: "Music", label: "APPROVED" },
  { id: "r966", name: "Garbanzo", url: "https://www.garbanzo.com", category: "Language Arts", label: "APPROVED" },
  { id: "r967", name: "Gasha Go!", url: "https://www.gashago.com", category: "Learning", label: "APPROVED" },
  { id: "r968", name: "Gatekeeper Systems", url: "https://www.gatekeepersystems.com", category: "Science", label: "APPROVED" },
  { id: "r969", name: "GeoGebra Classic", url: "https://www.geogebra.org", category: "Math", label: "APPROVED" },
  { id: "r970", name: "Geogebra Math", url: "https://www.geogebra.org", category: "Math", label: "APPROVED" },
  { id: "r971", name: "Georgia Studies Digital Textbook", url: "https://www.georgiastandards.org", category: "Language Arts", label: "APPROVED" },
  { id: "r972", name: "Gigaplex Academy", url: "https://www.gigaplexacademy.com", category: "Learning", label: "APPROVED" },
  { id: "r973", name: "Gimkit", url: "https://www.gimkit.com", category: "Assessment", label: "APPROVED" },
  { id: "r974", name: "Gizmo STEM Cases", url: "https://www.gizmostemcases.com", category: "Science", label: "APPROVED" },
  { id: "r975", name: "Go for Dash & Dot Robots", url: "https://www.gofordashdotrobots.com", category: "Learning", label: "APPROVED" },
  { id: "r976", name: "Hometown Health", url: "https://www.hometownhealth.com", category: "Learning", label: "APPROVED" },
  { id: "r977", name: "iCEV", url: "https://www.icev.com", category: "Career Readiness", label: "APPROVED" },
  { id: "r978", name: "Imagine Language & Literacy", url: "https://www.imaginelanguageliteracy.com", category: "Language Arts", label: "APPROVED" },
  { id: "r979", name: "Imagine MyPath", url: "https://www.imaginemypath.com", category: "Special Education", label: "APPROVED" },
  { id: "r980", name: "Junior Achievement of Georgia", url: "https://georgia.ja.org", category: "Career Readiness", label: "APPROVED" },
  { id: "r981", name: "Kesler Science", url: "https://www.keslerscience.com", category: "Science", label: "APPROVED" },
  { id: "r982", name: "Knowt", url: "https://www.knowt.com", category: "Assessment", label: "APPROVED" },
  { id: "r983", name: "LEGO Education SPIKE App 3.0", url: "https://www.legoeducationspikeapp30.com", category: "Learning", label: "APPROVED" },
  { id: "r984", name: "Magma", url: "https://www.magma.com", category: "Art", label: "APPROVED" },
  { id: "r985", name: "Mastery Connect", url: "https://www.masteryconnect.com", category: "Assessment", label: "APPROVED" },
  { id: "r986", name: "Membean", url: "https://www.membean.com", category: "Language Arts", label: "APPROVED" },
  { id: "r987", name: "Micro:bit", url: "https://microbit.org", category: "Coding", label: "APPROVED" },
  { id: "r988", name: "Microsoft EDU - Education Connector", url: "https://education.microsoft.com", category: "Learning", label: "APPROVED" },
  { id: "r989", name: "MimioSTEM", url: "https://www.mimiostem.com", category: "Science", label: "APPROVED" },
  { id: "r990", name: "Music Theory", url: "https://www.musictheory.com", category: "Music", label: "APPROVED" },
  { id: "r991", name: "myViewBoard", url: "https://www.myviewboard.com", category: "Learning", label: "APPROVED" },
  { id: "r992", name: "National Archives Catalog", url: "https://catalog.archives.gov", category: "Social Studies", label: "APPROVED" },
  { id: "r993", name: "National Cyber League", url: "https://nationalcyberleague.org", category: "Cybersecurity", label: "APPROVED" },
  { id: "r994", name: "National Weather Service", url: "https://www.weather.gov", category: "Science", label: "APPROVED" },
  { id: "r995", name: "O*Net Online", url: "https://www.onetonline.org", category: "Career Readiness", label: "APPROVED" },
  { id: "r996", name: "Ology: Science for Kids", url: "https://www.amnh.org/explore/ology", category: "Science", label: "APPROVED" },
  { id: "r997", name: "Osmo", url: "https://www.osmo.com", category: "Special Education", label: "APPROVED" },
  { id: "r998", name: "ParentSquare", url: "https://www.parentsquare.com", category: "Learning", label: "APPROVED" },
  { id: "r999", name: "Parlay", url: "https://www.parlay.com", category: "Learning", label: "APPROVED" },
  { id: "r1000", name: "PebbleGo", url: "https://www.pebblego.com", category: "Learning", label: "APPROVED" },
  { id: "r1001", name: "Quill", url: "https://www.quill.com", category: "Language Arts", label: "APPROVED" },
  { id: "r1002", name: "Radio Engineering Industries", url: "https://www.radioengineeringindustries.com", category: "Learning", label: "APPROVED" },
  { id: "r1003", name: "Read&Write", url: "https://www.texthelp.com/products/read-and-write-education", category: "Language Arts", label: "APPROVED" },
  { id: "r1004", name: "Safe Fleet", url: "https://www.safefleet.com", category: "Learning", label: "APPROVED" },
  { id: "r1005", name: "SafeExamBrowser app", url: "https://www.safeexambrowserapp.com", category: "Assessment", label: "APPROVED" },
  { id: "r1006", name: "SciJinks", url: "https://scijinks.gov", category: "Science", label: "APPROVED" },
  { id: "r1007", name: "Short Answer", url: "https://www.shortanswer.com", category: "Assessment", label: "APPROVED" },
  { id: "r1008", name: "Sora", url: "https://soraapp.com", category: "Language Arts", label: "APPROVED" },
  { id: "r1009", name: "Soundzabound", url: "https://www.soundzabound.com", category: "Music", label: "APPROVED" },
  { id: "r1010", name: "Specdrums Edu app", url: "https://www.specdrumseduapp.com", category: "Music", label: "APPROVED" },
  { id: "r1011", name: "Sphero Edu", url: "https://www.spheroedu.com", category: "Special Education", label: "APPROVED" },
  { id: "r1012", name: "Sphero Edu Jr", url: "https://www.spheroedujr.com", category: "Special Education", label: "APPROVED" },
  { id: "r1013", name: "Stop Motion Studio", url: "https://www.stopmotionstudio.com", category: "Coding", label: "APPROVED" },
  { id: "r1014", name: "Story Wheel App", url: "https://www.storywheelapp.com", category: "Language Arts", label: "APPROVED" },
  { id: "r1015", name: "Symphony Math", url: "https://www.symphonymath.com", category: "Math", label: "APPROVED" },
  { id: "r1016", name: "Texas Gateway", url: "https://www.texasgateway.org", category: "Career Readiness", label: "APPROVED" },
  { id: "r1017", name: "The Stock Market Game", url: "https://www.smgww.org", category: "Career Readiness", label: "APPROVED" },
  { id: "r1018", name: "The White House", url: "https://www.whitehouse.gov", category: "Social Studies", label: "APPROVED" },
  { id: "r1019", name: "UGA Extension", url: "https://extension.uga.edu", category: "Social Studies", label: "APPROVED" },
  { id: "r1020", name: "Varsity Yearbook", url: "https://www.varsityyearbook.com", category: "Language Arts", label: "APPROVED" },
  { id: "r1021", name: "Virtual Nerd", url: "https://www.virtualnerd.com", category: "Career Readiness", label: "APPROVED" },
  { id: "r1022", name: "Wayground", url: "https://www.wayground.com", category: "Learning", label: "APPROVED" },
  { id: "r1023", name: "Wayside Publishing APprenons", url: "https://www.waysidepublishingapprenons.com", category: "World Languages", label: "APPROVED" },
  { id: "r1024", name: "Wayside Publishing Azulejo", url: "https://www.waysidepublishingazulejo.com", category: "World Languages", label: "APPROVED" },
  { id: "r1025", name: "Wayside Publishing Neue", url: "https://www.waysidepublishingneue.com", category: "World Languages", label: "APPROVED" },
  { id: "r1026", name: "Wayside Publishing Triángulo", url: "https://www.waysidepublishingtriángulo.com", category: "World Languages", label: "APPROVED" },
  { id: "r1027", name: "Wonder For DASH", url: "https://www.wonderfordash.com", category: "Learning", label: "APPROVED" },
  { id: "r1028", name: "Zearn", url: "https://www.zearn.org", category: "Math", label: "APPROVED" },
  { id: "r1029", name: "Benchmark Universe", url: "https://www.benchmarkeducation.com", category: "Language Arts", label: "PREFERRED" },
  { id: "r1030", name: "Canvas", url: "https://www.instructure.com/canvas", category: "LMS", label: "PREFERRED" },
  { id: "r1031", name: "ClassLink Roster Server", url: "https://www.classlink.com", category: "LMS", label: "PREFERRED" },
  { id: "r1032", name: "Classwize", url: "https://classwize.com", category: "LMS", label: "PREFERRED" },
  { id: "r1033", name: "Clever", url: "https://clever.com", category: "LMS", label: "PREFERRED" },
  { id: "r1034", name: "DeltaMath", url: "https://www.deltamath.com", category: "Math", label: "PREFERRED" },
  { id: "r1035", name: "Destiny Discover TCC1.3", url: "https://www.follett.com/destiny", category: "LMS", label: "PREFERRED" },
  { id: "r1036", name: "Educlimber", url: "https://www.educlimber.com", category: "LMS", label: "PREFERRED" },
  { id: "r1037", name: "FastBridge", url: "https://www.fastbridge.org", category: "Math", label: "PREFERRED" },
  { id: "r1038", name: "GaDOE SuitCASE", url: "https://www.gadoe.org", category: "Learning", label: "PREFERRED" },
  { id: "r1039", name: "Get Connected Volunteer Technology", url: "https://www.galaxydigital.com", category: "Learning", label: "PREFERRED" },
  { id: "r1040", name: "Google Chrome", url: "https://www.google.com/chrome", category: "Productivity", label: "PREFERRED" },
  { id: "r1041", name: "Google Drive", url: "https://drive.google.com", category: "Productivity", label: "PREFERRED" },
  { id: "r1042", name: "Great Minds", url: "https://greatminds.org", category: "Math", label: "PREFERRED" },
  { id: "r1043", name: "i-Ready", url: "https://www.curriculumassociates.com/programs/i-ready", category: "Math", label: "PREFERRED" },
  { id: "r1044", name: "Imagine Edgenuity", url: "https://www.imaginelearning.com/edgenuity", category: "LMS", label: "PREFERRED" },
  { id: "r1045", name: "Incident IQ", url: "https://incidentiq.com", category: "Learning", label: "PREFERRED" },
  { id: "r1046", name: "Infinite Campus", url: "https://www.infinitecampus.com", category: "LMS", label: "PREFERRED" },
  { id: "r1047", name: "LaunchPad", url: "https://launchpadlearning.com", category: "LMS", label: "PREFERRED" },
  { id: "r1048", name: "Microsoft Excel", url: "https://www.microsoft.com/excel", category: "Productivity", label: "PREFERRED" },
  { id: "r1049", name: "Microsoft Office 365", url: "https://www.microsoft.com/microsoft-365", category: "Productivity", label: "PREFERRED" },
  { id: "r1050", name: "Microsoft OneDrive", url: "https://www.microsoft.com/onedrive", category: "Productivity", label: "PREFERRED" },
  { id: "r1051", name: "Microsoft OneNote", url: "https://www.microsoft.com/onenote", category: "Productivity", label: "PREFERRED" },
  { id: "r1052", name: "Microsoft Outlook", url: "https://www.microsoft.com/outlook", category: "Productivity", label: "PREFERRED" },
  { id: "r1053", name: "Microsoft PowerPoint", url: "https://www.microsoft.com/powerpoint", category: "Productivity", label: "PREFERRED" },
  { id: "r1054", name: "Microsoft Teams Classes", url: "https://www.microsoft.com/teams", category: "Productivity", label: "PREFERRED" },
  { id: "r1055", name: "Microsoft Teams Meetings", url: "https://www.microsoft.com/teams", category: "Productivity", label: "PREFERRED" },
  { id: "r1056", name: "Microsoft Word", url: "https://www.microsoft.com/word", category: "Productivity", label: "PREFERRED" },
  { id: "r1057", name: "Mosaic Cafeteria Management", url: "https://www.mosaicmgmt.com", category: "Learning", label: "PREFERRED" },
  { id: "r1058", name: "myON", url: "https://www.myon.com", category: "Language Arts", label: "PREFERRED" },
  { id: "r1059", name: "MyVRSpot", url: "https://www.myvrspot.com", category: "Learning", label: "PREFERRED" },
  { id: "r1060", name: "Nearpod", url: "https://nearpod.com", category: "LMS", label: "PREFERRED" },
  { id: "r1061", name: "Neptune Navigate", url: "https://neptunenavigate.com", category: "Learning", label: "PREFERRED" },
  { id: "r1062", name: "Perry Weather", url: "https://perryweather.com", category: "Learning", label: "PREFERRED" },
  { id: "r1063", name: "School Pay", url: "https://www.schoolpay.com", category: "Learning", label: "PREFERRED" },
  { id: "r1064", name: "SchoolCity", url: "https://www.schoolcity.com", category: "LMS", label: "PREFERRED" },
  { id: "r1065", name: "STEMscopes", url: "https://www.stemscopes.com", category: "Math", label: "PREFERRED" },
  { id: "r1066", name: "Studies Weekly", url: "https://www.studiesweekly.com", category: "Language Arts", label: "PREFERRED" },
  { id: "r1067", name: "Subject", url: "https://www.subject.com", category: "Learning", label: "PREFERRED" },
  { id: "r1068", name: "TalkingPoints", url: "https://talkingpts.org", category: "Learning", label: "PREFERRED" },
  { id: "r1069", name: "Unite for Literacy LTI Interface", url: "https://www.uniteforliteracy.com", category: "Language Arts", label: "PREFERRED" },
  { id: "r1070", name: "Wixie", url: "https://www.wixie.com", category: "Language Arts", label: "PREFERRED" },
  { id: "r1071", name: "Apex Learning Digital Curriculum", url: "https://www.apexlearning.com", category: "Career Readiness", label: "APPROVED LIMITED" },
  { id: "r1072", name: "Be Internet Awesome", url: "https://beinternetawesome.withgoogle.com", category: "Cybersecurity", label: "APPROVED LIMITED" },
  { id: "r1073", name: "Calculus for AP", url: "https://www.calculusforap.com", category: "Math", label: "APPROVED LIMITED" },
  { id: "r1074", name: "Chrome Music Lab", url: "https://musiclab.chromeexperiments.com", category: "Science", label: "APPROVED LIMITED" },
  { id: "r1075", name: "Code Connection for Minecraft", url: "https://minecraft.makecode.com", category: "Coding", label: "APPROVED LIMITED" },
  { id: "r1076", name: "CS First", url: "https://csfirst.withgoogle.com", category: "Coding", label: "APPROVED LIMITED" },
  { id: "r1077", name: "EBSCO LTI Integration", url: "https://www.ebsco.com", category: "Social Studies", label: "APPROVED LIMITED" },
  { id: "r1078", name: "Edthena", url: "https://www.edthena.com", category: "Learning", label: "APPROVED LIMITED" },
  { id: "r1079", name: "Encyclopedia Britannica Online", url: "https://www.britannica.com", category: "Social Studies", label: "APPROVED LIMITED" },
  { id: "r1080", name: "Ewell Educational Services", url: "https://www.ewell.com", category: "Learning", label: "APPROVED LIMITED" },
  { id: "r1081", name: "Flowlab.io", url: "https://flowlab.io", category: "Coding", label: "APPROVED LIMITED" },
  { id: "r1082", name: "G Metrix", url: "https://www.gmetrix.net", category: "Math", label: "APPROVED LIMITED" },
  { id: "r1083", name: "Galileo", url: "https://www.ati-online.com", category: "Career Readiness", label: "APPROVED LIMITED" },
  { id: "r1084", name: "Gold Seal Online Ground School", url: "https://www.goldsealonline.com", category: "Career Readiness", label: "APPROVED LIMITED" },
  { id: "r1085", name: "Google Arts and Culture", url: "https://artsandculture.google.com", category: "Social Studies", label: "APPROVED LIMITED" },
  { id: "r1086", name: "Google Chat", url: "https://chat.google.com", category: "Productivity", label: "APPROVED LIMITED" },
  { id: "r1087", name: "Google Colaboratory", url: "https://colab.research.google.com", category: "Science", label: "APPROVED LIMITED" },
  { id: "r1088", name: "Google Meet", url: "https://meet.google.com", category: "Productivity", label: "APPROVED LIMITED" },
  { id: "r1089", name: "Gopher Pack", url: "https://www.gopherpack.com", category: "Learning", label: "APPROVED LIMITED" },
  { id: "r1090", name: "Graspable Math (Temporary Entry)", url: "https://graspablemath.com", category: "Math", label: "APPROVED LIMITED" },
  { id: "r1091", name: "HMH Psychology 2018", url: "https://www.hmhpsychology2018.com", category: "Social Studies", label: "APPROVED LIMITED" },
  { id: "r1092", name: "HMH Sociology", url: "https://www.hmhsociology.com", category: "Social Studies", label: "APPROVED LIMITED" },
  { id: "r1093", name: "Hole\'s Essentials of Human Anatomy", url: "https://www.holesessentialsofhumananatomy.com", category: "Science", label: "APPROVED LIMITED" },
  { id: "r1094", name: "Home Designer Suite", url: "https://www.homedesignersoftware.com", category: "Art", label: "APPROVED LIMITED" },
  { id: "r1095", name: "Interland", url: "https://beinternetawesome.withgoogle.com/interland", category: "Cybersecurity", label: "APPROVED LIMITED" },
  { id: "r1096", name: "Intro to the Practice of Statistics", url: "https://www.introtothepracticeofstatistics.com", category: "Math", label: "APPROVED LIMITED" },
  { id: "r1097", name: "Kennesaw State University - Virtual School Programs", url: "https://vscp.kennesaw.edu", category: "Coding", label: "APPROVED LIMITED" },
  { id: "r1098", name: "Limmer Education", url: "https://limmereducation.com", category: "Career Readiness", label: "APPROVED LIMITED" },
  { id: "r1099", name: "Mathia", url: "https://www.carnegielearning.com/products/mathia", category: "Math", label: "APPROVED LIMITED" },
  { id: "r1100", name: "Microsoft Copilot", url: "https://copilot.microsoft.com", category: "Productivity", label: "APPROVED LIMITED" },
  { id: "r1101", name: "Microsoft MakeCode", url: "https://makecode.com", category: "Coding", label: "APPROVED LIMITED" },
  { id: "r1102", name: "MIND Research Institute - ST Math", url: "https://www.stmath.com", category: "Math", label: "APPROVED LIMITED" },
  { id: "r1103", name: "News2You", url: "https://www.n2y.com/news-2-you", category: "Language Arts", label: "APPROVED LIMITED" },
  { id: "r1104", name: "NOAA.gov", url: "https://www.noaa.gov", category: "Science", label: "APPROVED LIMITED" },
  { id: "r1105", name: "NotebookLM", url: "https://notebooklm.google.com", category: "Language Arts", label: "APPROVED LIMITED" },
  { id: "r1106", name: "Novelist", url: "https://www.ebscohost.com/novelist", category: "Language Arts", label: "APPROVED LIMITED" },
  { id: "r1107", name: "OrbitNote", url: "https://www.orbitnote.com", category: "Language Arts", label: "APPROVED LIMITED" },
  { id: "r1108", name: "Path For Dash & Dot", url: "https://www.makewonder.com", category: "Learning", label: "APPROVED LIMITED" },
  { id: "r1109", name: "PC Building Simulator 2", url: "https://www.pcbuildingsimulator.com", category: "Learning", label: "APPROVED LIMITED" },
  { id: "r1110", name: "Quick Draw", url: "https://quickdraw.withgoogle.com", category: "Coding", label: "APPROVED LIMITED" },
  { id: "r1111", name: "SIRS Discoverer", url: "https://www.proquest.com/products-services/SIRS-Discoverer.html", category: "Social Studies", label: "APPROVED LIMITED" },
  { id: "r1112", name: "Teachable Machine", url: "https://teachablemachine.withgoogle.com", category: "Coding", label: "APPROVED LIMITED" },
  { id: "r1113", name: "AbleSpace", url: "https://ablespace.io", category: "Special Education", label: "UNRATED" },
  { id: "r1114", name: "Amplify", url: "https://amplify.com", category: "Language Arts", label: "UNRATED" },
  { id: "r1115", name: "Amplify Math", url: "https://amplify.com/programs/math", category: "Math", label: "UNRATED" },
  { id: "r1116", name: "Applitrack", url: "https://www.applitrack.com", category: "Career Readiness", label: "UNRATED" },
  { id: "r1117", name: "ASA Aviation Training", url: "https://www.asa2fly.com", category: "Career Readiness", label: "UNRATED" },
  { id: "r1118", name: "ASE", url: "https://www.ase.com", category: "Career Readiness", label: "UNRATED" },
  { id: "r1119", name: "AWS Academy", url: "https://aws.amazon.com/training/awsacademy", category: "Coding", label: "UNRATED" },
  { id: "r1120", name: "Britannica School", url: "https://school.eb.com", category: "Language Arts", label: "UNRATED" },
  { id: "r1121", name: "BusRight", url: "https://busright.com", category: "Learning", label: "UNRATED" },
  { id: "r1122", name: "CleanUp", url: "https://cleanup.pictures", category: "Learning", label: "UNRATED" },
  { id: "r1123", name: "CogAT", url: "https://www.riverpub.com/products/cogAt", category: "Math", label: "UNRATED" },
  { id: "r1124", name: "Compass Cloud", url: "https://www.compasscloud.com", category: "Learning", label: "UNRATED" },
  { id: "r1125", name: "Construct Animate", url: "https://www.construct.net", category: "Coding", label: "UNRATED" },
  { id: "r1126", name: "CorelDraw", url: "https://www.coreldraw.com", category: "Coding", label: "UNRATED" },
  { id: "r1127", name: "CW Publications", url: "https://www.cwpublications.com", category: "Learning", label: "UNRATED" },
  { id: "r1128", name: "CYBER.ORG", url: "https://cyber.org", category: "Science", label: "UNRATED" },
  { id: "r1129", name: "CyberStart America", url: "https://www.cyberstartamerica.org", category: "Science", label: "UNRATED" },
  { id: "r1130", name: "DM Schedules", url: "https://www.dmschedules.com", category: "Learning", label: "UNRATED" },
  { id: "r1131", name: "Dyslexia Writing & Reading Assistant", url: "https://www.dyslexiaassistant.com", category: "Language Arts", label: "UNRATED" },
  { id: "r1132", name: "English Spanish Dictionary", url: "https://www.spanishdict.com", category: "World Languages", label: "UNRATED" },
  { id: "r1133", name: "Enlighten AI", url: "https://www.enlightenai.com", category: "AI Tools", label: "UNRATED" },
  { id: "r1134", name: "Epic Games", url: "https://www.epicgames.com", category: "Coding", label: "UNRATED" },
  { id: "r1135", name: "ERIC - Institute of Education Sciences", url: "https://eric.ed.gov", category: "Science", label: "UNRATED" },
  { id: "r1136", name: "Everway", url: "https://www.everway.com", category: "Learning", label: "UNRATED" },
  { id: "r1137", name: "Federal Reserve Education", url: "https://www.federalreserveeducation.org", category: "Social Studies", label: "UNRATED" },
  { id: "r1138", name: "Georgia Department of Driving Services", url: "https://dds.georgia.gov", category: "Art", label: "UNRATED" },
  { id: "r1139", name: "Groovelit", url: "https://groovelit.com", category: "Music", label: "UNRATED" },
  { id: "r1140", name: "IBIS - International Baccalaureate Information System", url: "https://ibis.ibo.org", category: "Science", label: "UNRATED" },
  { id: "r1141", name: "Image Creator", url: "https://www.bing.com/images/create", category: "Art", label: "UNRATED" },
  { id: "r1142", name: "Jigsaw Planet", url: "https://www.jigsawplanet.com", category: "Learning", label: "UNRATED" },
  { id: "r1143", name: "Kdenlive", url: "https://kdenlive.org", category: "Art", label: "UNRATED" },
  { id: "r1144", name: "ManageBac", url: "https://managebac.com", category: "Career Readiness", label: "UNRATED" },
  { id: "r1145", name: "Mascot Media", url: "https://www.mascotmedia.com", category: "Art", label: "UNRATED" },
  { id: "r1146", name: "Neal.fun Games", url: "https://neal.fun", category: "Learning", label: "UNRATED" },
  { id: "r1147", name: "NIEHS Kids\' Pages", url: "https://kids.niehs.nih.gov", category: "Science", label: "UNRATED" },
  { id: "r1148", name: "NPR Joy Generator", url: "https://www.npr.org/joy", category: "Learning", label: "UNRATED" },
  { id: "r1149", name: "Oklahoma Competency Testing", url: "https://www.okcompetency.com", category: "Assessment", label: "UNRATED" },
  { id: "r1150", name: "Output Capture App", url: "https://www.outputcapture.com", category: "Assessment", label: "UNRATED" },
  { id: "r1151", name: "Production Pro", url: "https://www.productionpro.co", category: "Music", label: "UNRATED" },
  { id: "r1152", name: "Qustodio", url: "https://www.qustodio.com", category: "Learning", label: "UNRATED" },
  { id: "r1153", name: "RackCoach", url: "https://www.rackcoach.com", category: "Career Readiness", label: "UNRATED" },
  { id: "r1154", name: "Sandbox AR", url: "https://sandboxar.com", category: "Coding", label: "UNRATED" },
  { id: "r1155", name: "Shopify", url: "https://www.shopify.com", category: "Career Readiness", label: "UNRATED" },
  { id: "r1156", name: "Stage Player", url: "https://www.stageplayer.com", category: "Music", label: "UNRATED" },
  { id: "r1157", name: "TestOut", url: "https://www.testout.com", category: "Career Readiness", label: "UNRATED" },
  { id: "r1158", name: "The MT Pit", url: "https://www.themtpit.com", category: "Music", label: "UNRATED" },
  { id: "r1159", name: "Udemy Business", url: "https://business.udemy.com", category: "Career Readiness", label: "UNRATED" },
  { id: "r1160", name: "Unity AAC", url: "https://www.unitedaac.com", category: "Coding", label: "UNRATED" },
  { id: "r1161", name: "Vectorworks", url: "https://www.vectorworks.net", category: "Coding", label: "UNRATED" },
  { id: "r1162", name: "VIQRC Hub", url: "https://www.roboticseducation.org", category: "Theatre", label: "UNRATED" },
  { id: "r1163", name: "VLC Media Player", url: "https://www.videolan.org/vlc", category: "Art", label: "UNRATED" },
  { id: "r1164", name: "X32-Mix", url: "https://www.behringer.com", category: "Music", label: "UNRATED" },
  { id: "r1165", name: "7 Mindsets", url: "https://www.7mindsets.com", category: "Learning", label: "APPROVED - Subscription Required" },
  { id: "r1166", name: "ABCYa", url: "https://www.abcya.com", category: "Learning", label: "APPROVED - Subscription Required" },
  { id: "r1167", name: "Book Break", url: "https://www.bookbreak.com", category: "Language Arts", label: "APPROVED - Subscription Required" },
  { id: "r1168", name: "Book Creator", url: "https://bookcreator.com", category: "Language Arts", label: "APPROVED - Subscription Required" },
  { id: "r1169", name: "Breakout EDU", url: "https://www.breakoutedu.com", category: "Learning", label: "APPROVED - Subscription Required" },
  { id: "r1170", name: "Class Composer", url: "https://classcomposer.com", category: "Productivity", label: "APPROVED - Subscription Required" },
  { id: "r1171", name: "Defined Learning PBL", url: "https://www.definedlearning.com", category: "Social Studies", label: "APPROVED - Subscription Required" },
  { id: "r1172", name: "Document Studio", url: "https://workspace.google.com/marketplace/app/document_studio", category: "Productivity", label: "APPROVED - Subscription Required" },
  { id: "r1173", name: "Draftback", url: "https://draftback.com", category: "Productivity", label: "APPROVED - Subscription Required" },
  { id: "r1174", name: "Education.com", url: "https://www.education.com", category: "Learning", label: "APPROVED - Subscription Required" },
  { id: "r1175", name: "Elevate", url: "https://www.elevateapp.com", category: "Language Arts", label: "APPROVED - Subscription Required" },
  { id: "r1176", name: "ESGI", url: "https://www.esgisoftware.com", category: "Assessment", label: "APPROVED - Subscription Required" },
  { id: "r1177", name: "Facts4Me", url: "https://www.facts4me.com", category: "Language Arts", label: "APPROVED - Subscription Required" },
  { id: "r1178", name: "FilmFlow.ai", url: "https://filmflow.ai", category: "Art", label: "APPROVED - Subscription Required" },
  { id: "r1179", name: "FlexTime Manager", url: "https://www.flextimemanager.com", category: "Productivity", label: "APPROVED - Subscription Required" },
  { id: "r1180", name: "Flocabulary", url: "https://www.flocabulary.com", category: "Language Arts", label: "APPROVED - Subscription Required" },
  { id: "r1181", name: "Gallopade", url: "https://www.gallopade.com", category: "Social Studies", label: "APPROVED - Subscription Required" },
  { id: "r1182", name: "Generation Genius", url: "https://www.generationgenius.com", category: "Science", label: "APPROVED - Subscription Required" },
  { id: "r1183", name: "H5P.com", url: "https://h5p.com", category: "Art", label: "APPROVED - Subscription Required" },
  { id: "r1184", name: "Handwriting without Tears", url: "https://www.learningwithouttears.com", category: "Language Arts", label: "APPROVED - Subscription Required" },
  { id: "r1185", name: "Happy Numbers", url: "https://happynumbers.com", category: "Math", label: "APPROVED - Subscription Required" },
  { id: "r1186", name: "HB Auditory Memory App", url: "https://www.superduperinc.com", category: "Language Arts", label: "APPROVED - Subscription Required" },
  { id: "r1187", name: "HB Following Directions", url: "https://www.superduperinc.com", category: "Language Arts", label: "APPROVED - Subscription Required" },
  { id: "r1188", name: "HB Phonological Awareness", url: "https://www.superduperinc.com", category: "Language Arts", label: "APPROVED - Subscription Required" },
  { id: "r1189", name: "HearBuilder", url: "https://www.hearbuilder.com", category: "Language Arts", label: "APPROVED - Subscription Required" },
  { id: "r1190", name: "Horizon Education: SAT & ACT Readiness", url: "https://www.horizoneducation.com", category: "Language Arts", label: "APPROVED - Subscription Required" },
  { id: "r1191", name: "iDismiss", url: "https://www.idismiss.com", category: "Productivity", label: "APPROVED - Subscription Required" },
  { id: "r1192", name: "IXL Learning", url: "https://www.ixl.com", category: "Math", label: "APPROVED - Subscription Required" },
  { id: "r1193", name: "Keyboarding Without Tears", url: "https://www.learningwithouttears.com/keyboarding", category: "Coding", label: "APPROVED - Subscription Required" },
  { id: "r1194", name: "Lalilo by Renaissance", url: "https://www.lalilo.com", category: "Language Arts", label: "APPROVED - Subscription Required" },
  { id: "r1195", name: "Learning A-Z", url: "https://www.learninga-z.com", category: "Language Arts", label: "APPROVED - Subscription Required" },
  { id: "r1196", name: "Learning Farm", url: "https://www.learningfarm.com", category: "Learning", label: "APPROVED - Subscription Required" },
  { id: "r1197", name: "Learning Without Tears", url: "https://www.learningwithouttears.com", category: "Special Education", label: "APPROVED - Subscription Required" },
  { id: "r1198", name: "LearnZillion", url: "https://learnzillion.com", category: "Language Arts", label: "APPROVED - Subscription Required" },
  { id: "r1199", name: "Legends of Learning", url: "https://www.legendsoflearning.com", category: "Math", label: "APPROVED - Subscription Required" },
  { id: "r1200", name: "Let\'s Go Learn", url: "https://www.letsgolearn.com", category: "Language Arts", label: "APPROVED - Subscription Required" },
  { id: "r1201", name: "Lexia", url: "https://www.lexialearning.com", category: "Language Arts", label: "APPROVED - Subscription Required" },
  { id: "r1202", name: "Liftoff Adaptive Intervention (2-8)", url: "https://www.renaissance.com/products/liftoff", category: "Language Arts", label: "APPROVED - Subscription Required" },
  { id: "r1203", name: "Lyfe Course", url: "https://www.lyfecourse.com", category: "Career Readiness", label: "APPROVED - Subscription Required" },
  { id: "r1204", name: "MackinVIA", url: "https://www.mackin.com/mackinvia", category: "Learning", label: "APPROVED - Subscription Required" },
  { id: "r1205", name: "Merge EDU", url: "https://mergeedu.com", category: "Science", label: "APPROVED - Subscription Required" },
  { id: "r1206", name: "MobyMax", url: "https://www.mobymax.com", category: "Language Arts", label: "APPROVED - Subscription Required" },
  { id: "r1207", name: "MusicFirst", url: "https://www.musicfirst.com", category: "Music", label: "APPROVED - Subscription Required" },
  { id: "r1208", name: "Newsela", url: "https://newsela.com", category: "Language Arts", label: "APPROVED - Subscription Required" },
  { id: "r1209", name: "Newzik", url: "https://newzik.com", category: "Music", label: "APPROVED - Subscription Required" },
  { id: "r1210", name: "Padlet", url: "https://padlet.com", category: "Productivity", label: "APPROVED - Subscription Required" },
  { id: "r1211", name: "PBIS Rewards", url: "https://www.pbisrewards.com", category: "Productivity", label: "APPROVED - Subscription Required" },
  { id: "r1212", name: "Pear Assessment", url: "https://www.peardeck.com/assessment", category: "Assessment", label: "APPROVED - Subscription Required" },
  { id: "r1213", name: "Pixiton EDU", url: "https://www.pixitonedu.com", category: "Learning", label: "APPROVED - Subscription Required" },
  { id: "r1214", name: "Plasma Games", url: "https://www.plasmagames.com", category: "Science", label: "APPROVED - Subscription Required" },
  { id: "r1215", name: "Reading Eggs", url: "https://readingeggs.com", category: "Language Arts", label: "APPROVED - Subscription Required" },
  { id: "r1216", name: "Reading Horizons Discovery", url: "https://www.readinghorizons.com", category: "Language Arts", label: "APPROVED - Subscription Required" },
  { id: "r1217", name: "Reflex, Frax, Science4Us & Gizmos", url: "https://www.explorelearning.com", category: "Math", label: "APPROVED - Subscription Required" },
  { id: "r1218", name: "Rockalingua", url: "https://rockalingua.com", category: "Music", label: "APPROVED - Subscription Required" },
  { id: "r1219", name: "Scholastic Digital Manager", url: "https://digital.scholastic.com", category: "Language Arts", label: "APPROVED - Subscription Required" },
  { id: "r1220", name: "Screencastify", url: "https://www.screencastify.com", category: "Art", label: "APPROVED - Subscription Required" },
  { id: "r1221", name: "Seesaw", url: "https://web.seesaw.me", category: "Language Arts", label: "APPROVED - Subscription Required" },
  { id: "r1222", name: "SketchCop", url: "https://www.sketchcop.com", category: "Art", label: "APPROVED - Subscription Required" },
  { id: "r1223", name: "SmartMusic", url: "https://www.smartmusic.com", category: "Music", label: "APPROVED - Subscription Required" },
  { id: "r1224", name: "Smore", url: "https://www.smore.com", category: "Productivity", label: "APPROVED - Subscription Required" },
  { id: "r1225", name: "Snap&Read", url: "https://www.snapandread.com", category: "Language Arts", label: "APPROVED - Subscription Required" },
  { id: "r1226", name: "SNO Sites", url: "https://snosites.com", category: "Career Readiness", label: "APPROVED - Subscription Required" },
  { id: "r1227", name: "Splats", url: "https://www.splatsinteractive.com", category: "Learning", label: "APPROVED - Subscription Required" },
  { id: "r1228", name: "Starfall", url: "https://www.starfall.com", category: "Language Arts", label: "APPROVED - Subscription Required" },
  { id: "r1229", name: "Storyboard", url: "https://www.storyboardthat.com", category: "Language Arts", label: "APPROVED - Subscription Required" },
  { id: "r1230", name: "Student Support Time", url: "https://www.studentsupporttime.com", category: "Assessment", label: "APPROVED - Subscription Required" },
  { id: "r1231", name: "Swivl", url: "https://www.swivl.com", category: "Art", label: "APPROVED - Subscription Required" },
  { id: "r1232", name: "The Voyage for Schools", url: "https://www.thevoyage.com", category: "Career Readiness", label: "APPROVED - Subscription Required" },
  { id: "r1233", name: "TreeRing", url: "https://treering.com", category: "Career Readiness", label: "APPROVED - Subscription Required" },
  { id: "r1234", name: "Typing Club School Edition Basic", url: "https://www.typingclub.com", category: "Coding", label: "APPROVED - Subscription Required" },
  { id: "r1235", name: "Typing.com", url: "https://www.typing.com", category: "Coding", label: "APPROVED - Subscription Required" },
  { id: "r1236", name: "Vmath Live", url: "https://www.voyagersopris.com/vmath", category: "Math", label: "APPROVED - Subscription Required" },
  { id: "r1237", name: "Wet-Dry-Try Handwriting app", url: "https://www.learningwithouttears.com", category: "Language Arts", label: "APPROVED - Subscription Required" },
  { id: "r1238", name: "WeVideo", url: "https://www.wevideo.com", category: "Art", label: "APPROVED - Subscription Required" },
  { id: "r1239", name: "Write Score", url: "https://writescore.com", category: "Language Arts", label: "APPROVED - Subscription Required" },
  { id: "r1240", name: "XtraMath", url: "https://xtramath.org", category: "Math", label: "APPROVED - Subscription Required" },
  { id: "r1241", name: "zSpace", url: "https://zspace.com", category: "Learning", label: "APPROVED - Subscription Required" },
];

// ─── Sort resources alphabetically by name (case-insensitive) ────────────────
const sortResources = (list) =>
  [...list].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
async function callClaude({ prompt, system = "", useWebSearch = false }) {
  const tools = useWebSearch ? [{ type: "web_search_20250305", name: "web_search" }] : undefined;
  let messages = [{ role: "user", content: prompt }];

  // Loop up to 8 turns to allow web search tool use to complete
  for (let turn = 0; turn < 8; turn++) {
    const body = { model: "claude-sonnet-4-20250514", max_tokens: 4000, system, messages };
    if (tools) body.tools = tools;

    const res = await fetch("/.netlify/functions/claude", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errText = await res.text();
      if (res.status === 429) {
        // Parse rate limit reset time if available
        try {
          const errJson = JSON.parse(errText);
          const inner = typeof errJson.error?.message === "string" ? JSON.parse(errJson.error.message) : {};
          const resetsAt = inner.resetsAt || inner.windows?.["5h"]?.resets_at;
          if (resetsAt) {
            const resetTime = new Date(resetsAt * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
            throw new Error(`Rate limit reached — analyses are temporarily paused. The limit resets at ${resetTime}. Please try again then.`);
          }
        } catch (parseErr) {
          if (parseErr.message.startsWith("Rate limit")) throw parseErr;
        }
        throw new Error("Rate limit reached — too many analyses in a short window. Please wait a few minutes and try again.");
      }
      throw new Error(`API error ${res.status}: ${errText}`);
    }
    const data = await res.json();
    const content = data.content || [];

    // If done, collect and return all text blocks
    if (data.stop_reason === "end_turn") {
      return content.filter(b => b.type === "text").map(b => b.text).join("\n");
    }

    // If tool_use, append assistant turn + tool results and continue
    if (data.stop_reason === "tool_use") {
      messages = [...messages, { role: "assistant", content }];
      const toolResults = content
        .filter(b => b.type === "tool_use")
        .map(b => ({
          type: "tool_result",
          tool_use_id: b.id,
          content: typeof b.input === "object" ? JSON.stringify(b.input) : String(b.input),
        }));
      messages = [...messages, { role: "user", content: toolResults }];
      continue;
    }

    // Fallback: return any text we have
    return content.filter(b => b.type === "text").map(b => b.text).join("\n");
  }
  throw new Error("Analysis timed out after too many tool-use turns.");
}

// ─── Robustly extract the first JSON object from a string ─────────────────────
function extractJSON(raw) {
  // Try direct parse first
  try { return JSON.parse(raw.trim()); } catch {}
  // Strip markdown fences
  const stripped = raw.replace(/```json|```/g, "").trim();
  try { return JSON.parse(stripped); } catch {}
  // Pull out the first {...} block
  const match = stripped.match(/\{[\s\S]*\}/);
  if (match) {
    try { return JSON.parse(match[0]); } catch {}
  }
  throw new Error("Could not parse JSON from response:\n" + raw.slice(0, 300));
}

// ─── Analyze a resource: find ToS/PP URLs + summarize data practices ──────────
async function analyzeResource(resource) {
  const system = `You are an expert in K-12 educational technology privacy compliance (COPPA, FERPA, SOPIPA).
Analyze EdTech platforms for data collection practices relevant to K-12 schools.
Use web search to find and read the actual Terms of Service and Privacy Policy pages.
Your entire response must be a single valid JSON object — no markdown, no explanation, no text outside the JSON.`;

  const knownUrls = [
    resource.tosUrl ? `Terms of Service URL (already known): ${resource.tosUrl}` : null,
    resource.ppUrl  ? `Privacy Policy URL (already known): ${resource.ppUrl}` : null,
  ].filter(Boolean).join("\n");

  const prompt = `Analyze this EdTech platform for K-12 data privacy compliance.

Platform Name: ${resource.name}
Platform URL: ${resource.url}
${knownUrls ? "\n" + knownUrls + "\n\nUse the URLs above — no need to search for them. Go straight to reading and analyzing those pages." : "\nUse web search to find the Terms of Service and Privacy Policy pages, then analyze them."}

Return ONLY this JSON object (no other text):
{
  "tosUrl": "full URL to Terms of Service page, or null if not found",
  "ppUrl": "full URL to Privacy Policy page, or null if not found",
  "accountRequired": true or false,
  "minAge": "e.g. 13, Under 13 with parental consent, Not specified",
  "dataCollected": ["specific data types collected, e.g. Name, Email, Usage data, Location"],
  "dataSharedWith": ["third party categories data is shared with, or None"],
  "studentDataSold": true or false or "Not specified",
  "coppaCompliant": true or false or "Not specified",
  "ferpaCompliant": true or false or "Not specified",
  "riskLevel": "Low" or "Medium" or "High",
  "riskReason": "one sentence explaining the risk rating",
  "parentSummary": "2-3 sentence plain-language summary for parents about what data is collected, why, and any notable protections or concerns",
  "compliance": {
    "GENQ1": "Meets" or "Partially" or "Not Met",
    "DCQ1": "Meets" or "Partially" or "Not Met",
    "DCQ2": "Meets" or "Partially" or "Not Met",
    "DCQ3": "Meets" or "Partially" or "Not Met",
    "DCQ4": "Meets" or "Partially" or "Not Met",
    "DCQ5": "Meets" or "Partially" or "Not Met",
    "SECQ1": "Meets" or "Partially" or "Not Met",
    "SECQ2": "Meets" or "Partially" or "Not Met",
    "SECQ3": "Meets" or "Partially" or "Not Met",
    "SECQ4": "Meets" or "Partially" or "Not Met",
    "SECQ5": "Meets" or "Partially" or "Not Met",
    "SHRQ1": "Meets" or "Partially" or "Not Met",
    "SHRQ2": "Meets" or "Partially" or "Not Met",
    "SHRQ3": "Meets" or "Partially" or "Not Met",
    "SHRQ4": "Meets" or "Partially" or "Not Met",
    "SHRQ5": "Meets" or "Partially" or "Not Met",
    "ADVQ1": "Meets" or "Partially" or "Not Met",
    "ADVQ2": "Meets" or "Partially" or "Not Met",
    "ADVQ3": "Meets" or "Partially" or "Not Met",
    "ADVQ4": "Meets" or "Partially" or "Not Met",
    "ADVQ5": "Meets" or "Partially" or "Not Met"
  },
  "complianceNotes": {
    "GENQ1": "1 sentence explanation of rating",
    "DCQ1": "1 sentence explanation of rating",
    "DCQ2": "1 sentence explanation of rating",
    "DCQ3": "1 sentence explanation of rating",
    "DCQ4": "1 sentence explanation of rating",
    "DCQ5": "1 sentence explanation of rating",
    "SECQ1": "1 sentence explanation of rating",
    "SECQ2": "1 sentence explanation of rating",
    "SECQ3": "1 sentence explanation of rating",
    "SECQ4": "1 sentence explanation of rating",
    "SECQ5": "1 sentence explanation of rating",
    "SHRQ1": "1 sentence explanation of rating",
    "SHRQ2": "1 sentence explanation of rating",
    "SHRQ3": "1 sentence explanation of rating",
    "SHRQ4": "1 sentence explanation of rating",
    "SHRQ5": "1 sentence explanation of rating",
    "ADVQ1": "1 sentence explanation of rating",
    "ADVQ2": "1 sentence explanation of rating",
    "ADVQ3": "1 sentence explanation of rating",
    "ADVQ4": "1 sentence explanation of rating",
    "ADVQ5": "1 sentence explanation of rating"
  }
}

Compliance question definitions for scoring:
GENQ1 - Policy change management: Meets=advance notification + revision history available; Partially=some notification but incomplete; Not Met=no notification process stated
DCQ1 - Lists all data collected: Meets=all data listed or states no data collected; Partially=some data listed; Not Met=vague or silent
DCQ2 - How data is collected: Meets=specifically states how; Partially=general statement; Not Met=not addressed
DCQ3 - Who owns the data: Meets=user owns data or no data collected; Partially=unclear ownership; Not Met=company claims ownership or silent
DCQ4 - Users can delete data: Meets=full deletion allowed; Partially=limited deletion or after a waiting period; Not Met=no deletion option
DCQ5 - Data retention period: Meets=specific retention period stated (90+ days) or general retention statement; Partially=vague; Not Met=not addressed
SECQ1 - How data is protected: Meets=specific security measures listed; Partially=general security statement; Not Met=not addressed
SECQ2 - Encryption: Meets=encrypted throughout or passes encryption test; Partially=partial encryption mentioned; Not Met=no encryption stated
SECQ3 - Strong password enforcement: Meets=enforces strong passwords or SSO/no account required; Partially=recommends but doesn't enforce; Not Met=no mention
SECQ4 - Multi-factor authentication: Meets=SSO/LTI or MFA available or no account required; Partially=optional MFA; Not Met=no MFA
SECQ5 - Cookie usage: Meets=all cookies listed with purpose or only functional cookies; Partially=mentions cookies generally; Not Met=no cookie policy
SHRQ1 - Use of third parties: Meets=specific third parties named; Partially=broad generalization; Not Met=no disclosure
SHRQ2 - What's shared with each third party: Meets=specific data per third party listed; Partially=grouped or unclear; Not Met=not disclosed
SHRQ3 - Opt out of third-party sharing: Meets=easy opt-out process or no third-party sharing; Partially=limited opt-out; Not Met=no opt-out
SHRQ4 - Third parties must follow vendor agreement: Meets=supplier claims responsibility or no third-party sharing; Partially=general statement; Not Met=no mention
SHRQ5 - Notification of third-party changes: Meets=notifies users of changes or no third parties; Partially=may update without notice; Not Met=no mention
ADVQ1 - Whether ads are displayed: Meets=no ads or only platform-based ads; Partially=ads before login only; Not Met=targeted ads displayed
ADVQ2 - Targeted advertising: Meets=no targeting or only platform ads; Partially=possible third-party targeting; Not Met=confirmed user targeting
ADVQ3 - Third-party tracking for ads: Meets=no tracking or opt-out available; Partially=third-party tracking with limited opt-out; Not Met=tracking with no opt-out
ADVQ4 - Web beacons/tracking methods: Meets=only functional tracking; Partially=unclear tracking methods; Not Met=tracking for ads confirmed
ADVQ5 - Opt out of data sharing with advertisers: Meets=clear opt-out process; Partially=opt-out mentioned but unclear; Not Met=no opt-out`;

  const raw = await callClaude({ prompt, system, useWebSearch: true });
  return extractJSON(raw);
}

// ─── Risk color mapping ───────────────────────────────────────────────────────
const RISK = {
  Low: { bg: "#d1fae5", text: "#065f46", dot: "#10b981" },
  Medium: { bg: "#fef3c7", text: "#92400e", dot: "#f59e0b" },
  High: { bg: "#fee2e2", text: "#7f1d1d", dot: "#ef4444" },
};

const CATEGORY_COLORS = {
  LMS: "#dbeafe", Learning: "#ede9fe", Assessment: "#fce7f3", "Study Tools": "#d1fae5",
  Portfolio: "#fef3c7", Presentation: "#ffedd5", Practice: "#e0f2fe", Design: "#fae8ff",
  Video: "#fee2e2", Collaboration: "#ecfdf5", Math: "#dbeafe", Language: "#ede9fe",
  Coding: "#d1fae5", Other: "#f3f4f6",
};

const LABELS = [
  "PREFERRED",
  "APPROVED",
  "APPROVED - District Managed",
  "APPROVED LIMITED",
  "APPROVED - Subscription Required",
  "REVIEWED",
  "PARENT PERMISSION REQUIRED",
  "RESTRICTED AUDIENCE ONLY",
  "STAFF USE ONLY",
  "UNDER REVIEW",
  "UNRATED",
  "DENIED",
];

const LABEL_STYLES = {
  "PREFERRED":                      { bg: "#d1fae5", text: "#065f46", border: "#6ee7b7" },
  "APPROVED":                       { bg: "#dbeafe", text: "#1e40af", border: "#93c5fd" },
  "APPROVED - District Managed":    { bg: "#dbeafe", text: "#1e40af", border: "#93c5fd" },
  "APPROVED LIMITED":               { bg: "#e0f2fe", text: "#0369a1", border: "#7dd3fc" },
  "APPROVED - Subscription Required":{ bg: "#ede9fe", text: "#5b21b6", border: "#c4b5fd" },
  "REVIEWED":                       { bg: "#f0fdf4", text: "#166534", border: "#86efac" },
  "PARENT PERMISSION REQUIRED":     { bg: "#fef3c7", text: "#92400e", border: "#fcd34d" },
  "RESTRICTED AUDIENCE ONLY":       { bg: "#ffedd5", text: "#9a3412", border: "#fdba74" },
  "STAFF USE ONLY":                 { bg: "#fce7f3", text: "#9d174d", border: "#f9a8d4" },
  "UNDER REVIEW":                   { bg: "#f3f4f6", text: "#374151", border: "#d1d5db" },
  "UNRATED":                        { bg: "#f1f5f9", text: "#475569", border: "#cbd5e1" },
  "DENIED":                         { bg: "#fee2e2", text: "#7f1d1d", border: "#fca5a5" },

};

// Labels that pre-authorize use — no parental signature or per-resource initials needed
const NO_CONSENT_LABELS = new Set([
  "PREFERRED",
  "APPROVED",
  "APPROVED - District Managed",
  "APPROVED - Subscription Required",
]);
function Spinner({ size = 16 }) {
  return (
    <span style={{
      display: "inline-block", width: size, height: size,
      border: `2px solid currentColor`, borderTopColor: "transparent",
      borderRadius: "50%", animation: "spin 0.7s linear infinite", flexShrink: 0
    }} />
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [view, setView] = useState("teacher"); // teacher | admin | pdf | compliance
  const [complianceResource, setComplianceResource] = useState(null);
  const [showFerpa, setShowFerpa] = useState(false);
  const [showCoppa, setShowCoppa] = useState(false);
  const [showCipa, setShowCipa] = useState(false);
  const [showClassroomVsExtra, setShowClassroomVsExtra] = useState(false);
  const [showApprovalProcess, setShowApprovalProcess] = useState(false);
  const [checklists, setChecklists] = useState({});
  const [checklistResource, setChecklistResource] = useState(null); // resource being edited in admin modal
  const [viewChecklistResource, setViewChecklistResource] = useState(null); // resource shown read-only in teacher modal
  const [pdfDownloaded, setPdfDownloaded] = useState(false);
  const [showSelectedOnly, setShowSelectedOnly] = useState(false);
  const [lastSynced, setLastSynced] = useState(null);
  const [adminAnalyzeLabel, setAdminAnalyzeLabel] = useState("APPROVED LIMITED");
  const [storageInfo, setStorageInfo] = useState(null);
  const [diagLoading, setDiagLoading] = useState(false);
  const [importMsg, setImportMsg] = useState(null);
  const importFileRef = React.useRef(null);
  const [parentForm, setParentForm] = useState({ parentName: "", studentName: "", date: "", optOut: false, initials: {}, signatureDataUrl: "" });
  const sigCanvasRef = React.useRef(null);
  const sigDrawing = React.useRef(false);
  const sigLastPos = React.useRef({ x: 0, y: 0 });
  const [syncing, setSyncing] = useState(false);
  const [resources, setResources] = useState([]);
  const [analyses, setAnalyses] = useState({});
  const [selected, setSelected] = useState({});
  const [analyzing, setAnalyzing] = useState({});
  const [analyzeError, setAnalyzeError] = useState({});
  const [teacherInfo, setTeacherInfo] = useState({ name: "", subject: "", grade: "", school: "", principal: "", year: new Date().getFullYear() + "-" + (new Date().getFullYear() + 1) });
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [labelFilters, setLabelFilters] = useState(new Set());
  const [visibleCount, setVisibleCount] = useState(12);
  const sentinelRef = React.useRef(null);

  // Reset visible count whenever filters/search change
  React.useEffect(() => { setVisibleCount(12); }, [search, categoryFilter, labelFilters, showSelectedOnly]);
  // Admin
  const [adminMode, setAdminMode] = useState(false);
  const [adminPass, setAdminPass] = useState("");
  const [adminPassInput, setAdminPassInput] = useState("");
  const [adminPassError, setAdminPassError] = useState(false);
  const [newRes, setNewRes] = useState({ name: "", url: "", category: "", label: "" });
  const [addingRes, setAddingRes] = useState(false);
  const [savingRes, setSavingRes] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [bulkAnalyzing, setBulkAnalyzing] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0, currentName: "" });
  const bulkCancelRef = useRef(false);
  const printRef = useRef(null);
  // Suggestion feature state
  const [showSuggestModal, setShowSuggestModal] = useState(false);
  const [suggestName, setSuggestName] = useState("");
  const [suggestUrl, setSuggestUrl] = useState("");
  const [suggestNote, setSuggestNote] = useState("");
  const [suggestStatus, setSuggestStatus] = useState(null);
  const [pendingSuggestions, setPendingSuggestions] = useState([]);
  const [suggestionsLoaded, setSuggestionsLoaded] = useState(false);

  const buildHTMLDoc = (selectedList, analyses, teacherInfo, pForm = {}) => {
    const RISK_CSS = { Low: { bg: "#d1fae5", text: "#065f46" }, Medium: { bg: "#fef3c7", text: "#92400e" }, High: { bg: "#fee2e2", text: "#7f1d1d" } };
    const rows = selectedList.map((r, i) => {
      const a = analyses[r.id];
      const rs = a?.riskLevel ? RISK_CSS[a.riskLevel] : null;
      return `<tr style="background:${i % 2 === 0 ? "#f7f5f1" : "white"}">
        <td style="padding:8px 10px;font-weight:700;color:#1c3557">${r.name}</td>
        <td style="padding:8px 10px">${r.category}</td>
        <td style="padding:8px 10px">${a ? (a.accountRequired ? "Yes" : "No") : "—"}</td>
        <td style="padding:8px 10px">${a?.minAge || "—"}</td>
        <td style="padding:8px 10px">${rs ? `<span style="padding:2px 8px;border-radius:12px;background:${rs.bg};color:${rs.text};font-weight:700">${a.riskLevel}</span>` : "—"}</td>
        <td style="padding:8px 10px">${a?.tosUrl ? `<a href="${a.tosUrl}">${a.tosUrl}</a>` : "—"}</td>
        <td style="padding:8px 10px">${a?.ppUrl ? `<a href="${a.ppUrl}">${a.ppUrl}</a>` : "—"}</td>
      </tr>`;
    }).join("");

    const consentList = selectedList.filter(r => !NO_CONSENT_LABELS.has(r.label));
    const details = consentList.map((r, idx) => {
      const a = analyses[r.id];
      const risk = a?.riskLevel;
      const rs = risk ? RISK_CSS[risk] : null;
      const analysisHtml = a?.done ? `
        <p style="color:#3c3529;line-height:1.7;margin:0 0 10px">${a.parentSummary || ""}</p>
        ${a.riskReason ? `<p style="color:#7c6f5e;font-style:italic;font-size:12px;margin:0 0 10px">Risk note: ${a.riskReason}</p>` : ""}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">
          <div style="padding:7px 10px;background:#f7f5f1;border-radius:8px"><strong>Account Required:</strong> ${a.accountRequired ? "Yes" : "No"}</div>
          <div style="padding:7px 10px;background:#f7f5f1;border-radius:8px"><strong>Minimum Age:</strong> ${a.minAge || "—"}</div>
          <div style="padding:7px 10px;background:#f7f5f1;border-radius:8px"><strong>Student Data Sold:</strong> ${a.studentDataSold === "Not specified" ? "Not Specified" : a.studentDataSold ? "Yes ⚠️" : "No"}</div>
          <div style="padding:7px 10px;background:#f7f5f1;border-radius:8px"><strong>Compliance:</strong> ${[a.coppaCompliant === true ? "COPPA ✓" : "", a.ferpaCompliant === true ? "FERPA ✓" : ""].filter(Boolean).join(" ") || "Not specified"}</div>
        </div>
        ${a.dataCollected?.length ? `<div style="margin-bottom:8px"><strong>Data Collected:</strong> <span style="color:#5c5044">${a.dataCollected.join(" · ")}</span></div>` : ""}
        ${a.dataSharedWith?.length ? `<div style="margin-bottom:12px"><strong>Shared With:</strong> <span style="color:#5c5044">${a.dataSharedWith.join(", ")}</span></div>` : ""}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px">
          <div style="padding:10px 12px;background:#f0f4fb;border-radius:8px;border-left:3px solid #3b6fba">
            <div style="font-size:11px;font-weight:700;color:#3b6fba;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">Terms of Service</div>
            ${a.tosUrl ? `<a href="${a.tosUrl}" style="color:#1c3557;font-size:11px;word-break:break-all">${a.tosUrl}</a>` : '<span style="color:#9c8e81;font-size:11px;font-style:italic">Not found</span>'}
          </div>
          <div style="padding:10px 12px;background:#f0f4fb;border-radius:8px;border-left:3px solid #3b6fba">
            <div style="font-size:11px;font-weight:700;color:#3b6fba;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">Privacy Policy</div>
            ${a.ppUrl ? `<a href="${a.ppUrl}" style="color:#1c3557;font-size:11px;word-break:break-all">${a.ppUrl}</a>` : '<span style="color:#9c8e81;font-size:11px;font-style:italic">Not found</span>'}
          </div>
        </div>` : `<div style="padding:12px;background:#fef9c3;border-radius:8px;color:#854d0e;font-size:13px;margin-bottom:16px">⚠️ Privacy analysis not yet completed for this tool.</div>`;

      return `<div style="margin-bottom:28px;padding-bottom:28px;${idx < consentList.length - 1 ? "border-bottom:1px solid #e2ddd5" : ""}">
        <div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:10px">
          <div style="width:30px;height:30px;min-width:30px;background:#1c3557;color:white;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px">${idx + 1}</div>
          <div>
            <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
              <span style="font-weight:800;font-size:16px;color:#1c3557">${r.name}</span>
              <span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px;background:#e0f2fe">${r.category}</span>
              ${rs ? `<span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px;background:${rs.bg};color:${rs.text}">${risk} Risk</span>` : ""}
            </div>
            <div style="font-size:12px;color:#3b6fba">${r.url}</div>
          </div>
        </div>
        <div style="padding-left:42px;font-size:13px">
          ${analysisHtml}
          ${!NO_CONSENT_LABELS.has(r.label) ? `
          <div style="display:flex;align-items:center;border-top:1px dashed #c8c0b4;padding-top:12px;margin-top:4px" class="no-print-border">
            <div style="flex:1">
              <div style="font-size:11px;font-weight:700;color:#7c6f5e;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:5px">Parent / Guardian Initials</div>
              <div style="display:flex;align-items:center;gap:10px">
                <input type="text" maxlength="6" data-initial="${r.id}"
                  placeholder="initials"
                  style="width:100px;padding:4px 8px;border:none;border-bottom:2px solid #1c3557;font-family:Georgia,serif;font-size:22px;color:#1c3557;font-weight:700;text-align:center;background:transparent;outline:none;"
                  oninput="updateInitialStatus(this,'status-${r.id}')" />
                <span id="status-${r.id}" style="font-size:11px;color:#059669;font-weight:700;display:none">✓ Acknowledged</span>
              </div>
            </div>
            <div style="flex-shrink:0;display:flex;align-items:center;gap:8px;padding-left:28px;border-left:1px dashed #c8c0b4;margin-left:28px;cursor:pointer" onclick="toggleDecline(this,'${r.id}')">
              <div id="chk-${r.id}" style="width:18px;height:18px;border:2px solid #1c3557;border-radius:2px;flex-shrink:0;background:white;display:flex;align-items:center;justify-content:center;font-size:13px;color:white"></div>
              <span id="chklabel-${r.id}" style="font-size:11px;color:#7c6f5e;font-weight:600;line-height:1.5">I decline consent<br/>for this tool</span>
            </div>
          </div>` : `
          <div style="border-top:1px dashed #c8c0b4;padding-top:10px;margin-top:4px">
            <span style="font-size:11px;font-weight:700;color:#059669;background:#d1fae5;padding:3px 10px;border-radius:20px">✓ District Approved — No parental signature required</span>
          </div>`}
        </div>
      </div>`;
    }).join("");

    const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    const teacherRows = [
      teacherInfo.name ? `<div><strong style="color:#7c6f5e">Teacher:</strong> ${teacherInfo.name}</div>` : "",
      teacherInfo.subject ? `<div><strong style="color:#7c6f5e">Course:</strong> ${teacherInfo.subject}</div>` : "",
      teacherInfo.grade ? `<div><strong style="color:#7c6f5e">Grade:</strong> ${teacherInfo.grade}</div>` : "",
      teacherInfo.school ? `<div><strong style="color:#7c6f5e">School:</strong> ${teacherInfo.school}</div>` : "",
      teacherInfo.principal ? `<div><strong style="color:#7c6f5e">Principal:</strong> ${teacherInfo.principal}</div>` : "",
    ].filter(Boolean).join("");

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>EdTech Privacy Disclosure</title>
<style>
  body { font-family: 'Palatino Linotype', Palatino, Georgia, serif; background: white; margin: 0; padding: 48px 64px; color: #3c3529; font-size: 13.5px; }
  @media print {
    body { padding: 0; }
    @page { margin: 2cm; }
    .no-print { display: none !important; }
    input, select { border: none !important; border-bottom: 2px solid #1c3557 !important; background: transparent !important; outline: none !important; -webkit-appearance: none; }
    canvas { border: none !important; border-bottom: 2px solid #1c3557 !important; }
    button { display: none !important; }
  }
  .page-break { page-break-after: always; margin-bottom: 0; padding-bottom: 48px; }
  table { border-collapse: collapse; width: 100%; }
  th { background: #1c3557; color: white; padding: 9px 10px; text-align: left; font-size: 11px; }
  td { padding: 8px 10px; font-size: 12px; }
  a { color: #3b6fba; word-break: break-all; }
  h1, h2, h3 { color: #1c3557; }
  .law-block { margin-bottom: 12px; padding: 12px 16px; background: #f7f5f1; border-left: 4px solid #1c3557; }
</style>
</head>
<body>

<!-- ══════════ PAGE 1: COVER LETTER ══════════ -->
<div class="page-break">

  <div style="border-bottom:3px solid #1c3557;padding-bottom:14px;margin-bottom:22px;overflow:hidden">
    <div style="float:left">
      <div style="font-size:11px;font-weight:700;color:#3b6fba;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">${teacherInfo.school || "School Name"}</div>
      <div style="font-size:20px;font-weight:700;color:#1c3557">Digital Tools &amp; Technology Notice</div>
    </div>
    <div style="float:right;text-align:right;font-size:12px;color:#9c8e81">
      <div>${today}</div>
      <div>Academic Year ${teacherInfo.year || ""}</div>
    </div>
    <div style="clear:both"></div>
  </div>

  <p style="margin:0 0 14px;line-height:1.8">To the Parent(s)/Guardian(s) of <strong>${teacherInfo.school || "[School Name]"} ${teacherInfo.subject || "[Subject]"}</strong> student,</p>

  <p style="margin:0 0 14px;line-height:1.8">${teacherInfo.school || "[School Name]"} would like to use several digital and online learning tools that will improve your student's educational experience. For students to use these programs &amp; services, a limited set of student personal information must be provided to web site operators. Several laws and policies direct our notification to parents and help protect our students online:</p>

  <div class="law-block">
    <div style="font-weight:700;color:#1c3557;margin-bottom:5px">Children's Internet Protection Act (CIPA):</div>
    <div style="margin-bottom:6px;line-height:1.7">The school is required by CIPA to have technology measures and policies in place that protect students from harmful materials including those that are obscene and pornographic. Any harmful content contained within inappropriate sites will be blocked.</div>
    <a href="http://fcc.gov/cgb/consumerfacts/cipa.html">http://fcc.gov/cgb/consumerfacts/cipa.html</a>
  </div>

  <div class="law-block">
    <div style="font-weight:700;color:#1c3557;margin-bottom:5px">Children's Online Privacy Protection Act (COPPA):</div>
    <div style="margin-bottom:6px;line-height:1.7">COPPA applies to commercial companies and limits their ability to collect personal information from children under 13 years of age. No personal student information is collected for commercial purposes.</div>
    <a href="https://www.ftc.gov/legal-library/browse/rules/childrens-online-privacy-protection-rule-coppa">https://www.ftc.gov/legal-library/browse/rules/childrens-online-privacy-protection-rule-coppa</a>
  </div>

  <div class="law-block">
    <div style="font-weight:700;color:#1c3557;margin-bottom:5px">Family Educational Rights and Privacy Act (FERPA):</div>
    <div style="margin-bottom:6px;line-height:1.7">FERPA protects the privacy of student education records and gives parents the right to review records. Under FERPA, schools may disclose student information in certain circumstances.</div>
    <a href="https://www2.ed.gov/policy/gen/guid/fpco/ferpa/index.html">https://www2.ed.gov/policy/gen/guid/fpco/ferpa/index.html</a>
  </div>

  <div class="law-block">
    <div style="font-weight:700;color:#1c3557;margin-bottom:8px">Forsyth County Schools Board Policies:</div>
    <div style="margin-bottom:4px"><strong>Policy JR &ndash; Student Records:</strong></div>
    <div style="margin-bottom:10px"><a href="https://simbli.eboardsolutions.com/Policy/ViewPolicy.aspx?S=4069&revid=7VCApLOplusrh9u8HVmfOZg9g==&ptid=amIgTZiB9plushNjl6WXhfiOQ==&secid=p6v70fD4K8ukRv6vtplusTtSg==&PG=6&IRP=0&isPndg=false">https://simbli.eboardsolutions.com/Policy/ViewPolicy.aspx?S=4069&amp;revid=7VCApLOplusrh9u8HVmfOZg9g== (Policy JR)</a></div>
    <div style="margin-bottom:4px"><strong>Policy IFBGE &ndash; Internet Safety:</strong></div>
    <div><a href="https://simbli.eboardsolutions.com/Policy/ViewPolicy.aspx?S=4069&revid=tooWVFbJVDegL3GG1nYFMA==&ptid=amIgTZiB9plushNjl6WXhfiOQ==&secid=qo79RWebAppsxbUbdO3GjATNVIJ7Q==&PG=6&IRP=0">https://simbli.eboardsolutions.com/Policy/ViewPolicy.aspx?S=4069&amp;revid=tooWVFbJVDegL3GG1nYFMA== (Policy IFBGE)</a></div>
  </div>

  <p style="margin:0 0 14px;line-height:1.8">Schools are permitted to consent to the disclosure of student personal information on behalf of parents under certain conditions, thereby eliminating the need for parental consent to be collected for every application or resource. The applications listed in the following pages have not met those conditions. Because Forsyth County Schools (FCS) has a goal to be transparent, FCS is providing you with this notice, and the opportunity to review and provide parent permission for the disclosure of student information to these resources.</p>

  <p style="margin:0 0 14px;line-height:1.8">Please take a moment to look at the attached list of websites and applications for your student's current classes, as well as each application's Terms of Service Agreement and/or Privacy Policy which describes what personal information the site collects.</p>

  <p style="margin:0 0 32px;line-height:1.8">After reviewing this information, please decide whether or not to provide your student with permission to utilize these web-based tools by initialing in each line for approved apps, completing the signature page and returning the completed document to <strong>${teacherInfo.name || "[Teacher Name]"}</strong>, a ${teacherInfo.subject || "[Subject]"} teacher.</p>

  <p style="margin:0 0 4px">Sincerely,</p>
  <div style="margin:16px 0 8px;width:280px;border-bottom:2px solid #1c3557;height:48px"></div>
  <p style="margin:0 0 2px;font-size:15px;font-weight:700;color:#1c3557">${teacherInfo.principal || "[Principal Name]"}</p>
  <p style="margin:0 0 2px;color:#7c6f5e">Principal</p>
  <p style="margin:0;color:#7c6f5e">${teacherInfo.school || "[School Name]"}</p>

</div>

<!-- ══════════ PAGE 2+: DISCLOSURE ══════════ -->

<div style="border-bottom:3px solid #1c3557;padding-bottom:18px;margin-bottom:24px;overflow:hidden">
  <div style="float:left">
    <h1 style="margin:0 0 4px;font-size:22px">Digital Tools &amp; Technology Notice</h1>
    <div style="color:#7c6f5e;font-size:13px">Syllabus Attachment &mdash; Privacy &amp; Data Disclosure</div>
  </div>
  <div style="float:right;text-align:right;font-size:12px;color:#9c8e81">
    <div>${today}</div>
    <div>Academic Year ${teacherInfo.year || ""}</div>
  </div>
  <div style="clear:both"></div>
</div>

${teacherRows ? `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px 20px;margin-bottom:24px;padding:16px;background:#f7f5f1;border-radius:12px;font-size:13px">${teacherRows}</div>` : ""}

<p style="margin:0 0 24px;line-height:1.75;font-size:13px">The following digital tools and online platforms are used in this course. In compliance with student data privacy requirements, this document discloses each platform's data collection practices, privacy policy, and terms of service. Please review and contact the teacher if you have any questions or concerns before your student uses any of these tools.</p>

<h2 style="margin:0 0 12px;font-size:16px">Quick Reference Summary</h2>
<table style="margin-bottom:32px">
  <thead><tr>
    <th>Tool</th><th>Category</th><th>Account Required</th><th>Min. Age</th><th>Risk Level</th><th>Terms of Service</th><th>Privacy Policy</th>
  </tr></thead>
  <tbody>${rows}</tbody>
</table>

<h2 style="margin:0 0 20px;font-size:16px;border-top:2px solid #e2ddd5;padding-top:20px">Detailed Platform Information</h2>
<p style="margin:0 0 20px;font-size:12px;color:#7c6f5e;line-height:1.7">The following tools require parent/guardian review and initials. District-approved tools (marked in the summary table above) do not require a signature and are omitted from this section.</p>
${consentList.length === 0 ? '<div style="padding:16px 20px;background:#d1fae5;border-radius:12px;border:2px solid #6ee7b7;font-size:13px;color:#065f46;font-weight:700;margin-bottom:32px">✓ All selected tools are District Approved — no detailed review or parental signature is required.</div>' : details}

<div style="margin-top:32px;padding:16px;background:#f7f5f1;border-radius:12px;font-size:12px;color:#7c6f5e;line-height:1.7;border-left:4px solid #1c3557">
  <strong>Notice to Parents &amp; Guardians:</strong> If you do not wish for your child to use any of the platforms listed above, please notify the teacher in writing within the first week of school. Alternative assignments may be available upon request. Risk levels and privacy summaries are AI-generated for informational purposes &mdash; always review official policy pages for the most current information.
</div>

${selectedList.some(r => !NO_CONSENT_LABELS.has(r.label)) ? `
<div style="margin-top:32px;border:2px solid #1c3557;border-radius:14px;overflow:hidden" id="sig-section">
  <div style="background:#1c3557;padding:12px 20px">
    <h3 style="margin:0;color:white;font-size:14px;font-weight:800;letter-spacing:0.5px;text-transform:uppercase">Parental / Guardian Acknowledgment</h3>
  </div>
  <div style="padding:20px 24px">
    <p style="margin:0 0 16px;font-size:13px;line-height:1.75">By initialing above next to each tool and signing below, I confirm that I have read and understand the digital tools and data privacy disclosures in this document.</p>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px 32px;margin-bottom:16px">
      <div>
        <div style="font-size:11px;font-weight:700;color:#7c6f5e;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px">Parent / Guardian Printed Name</div>
        <input type="text" id="parentName" placeholder="Full name" style="width:100%;padding:8px 10px;border:none;border-bottom:2px solid #1c3557;font-family:inherit;font-size:15px;color:#1c3557;background:transparent;outline:none;box-sizing:border-box" />
      </div>
      <div>
        <div style="font-size:11px;font-weight:700;color:#7c6f5e;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px">Student Name</div>
        <input type="text" id="studentName" placeholder="Student's full name" style="width:100%;padding:8px 10px;border:none;border-bottom:2px solid #1c3557;font-family:inherit;font-size:15px;color:#1c3557;background:transparent;outline:none;box-sizing:border-box" />
      </div>
      <div>
        <div style="font-size:11px;font-weight:700;color:#7c6f5e;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px">Date</div>
        <input type="date" id="sigDate" style="width:100%;padding:8px 10px;border:none;border-bottom:2px solid #1c3557;font-family:inherit;font-size:15px;color:#1c3557;background:transparent;outline:none;box-sizing:border-box" />
      </div>
    </div>

    <div style="margin-bottom:16px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <div style="font-size:11px;font-weight:700;color:#7c6f5e;text-transform:uppercase;letter-spacing:0.5px">
          Signature <span style="font-style:italic;font-weight:400;text-transform:none;color:#9c8e81;font-size:10px">(draw with mouse or finger)</span>
        </div>
        <button onclick="clearSig()" class="no-print" style="padding:4px 14px;border-radius:6px;border:1px solid #d4cfc7;background:white;color:#7c6f5e;font-family:inherit;font-size:12px;cursor:pointer">Clear</button>
      </div>
      <canvas id="sigCanvas" width="800" height="130" style="width:100%;height:130px;border:2px solid #1c3557;border-radius:8px;cursor:crosshair;display:block;touch-action:none;background:white"></canvas>
      <div id="sigStatus" style="font-size:11px;color:#9c8e81;margin-top:4px">Draw your signature above</div>
    </div>

    <div id="optOutBox" onclick="toggleOptOut()" style="margin-bottom:16px;padding:14px 16px;background:#f7f5f1;border-radius:10px;font-size:12px;color:#3c3529;line-height:1.7;cursor:pointer;border:1px solid transparent">
      <div style="display:flex;align-items:flex-start;gap:10px">
        <div id="optOutChk" style="width:18px;height:18px;border:2px solid #1c3557;border-radius:3px;flex-shrink:0;margin-top:2px;background:white;display:flex;align-items:center;justify-content:center;font-size:13px;color:white;transition:background 0.15s"></div>
        <span><strong>Opt-Out (click to check if applicable):</strong> I do not consent to my child using one or more of the platforms listed. I have attached a written note identifying which tools I am declining.</span>
      </div>
    </div>

    <div id="formStatus" style="padding:10px 16px;background:#fffbeb;border-radius:10px;font-size:12px;color:#92400e;margin-bottom:14px;text-align:center">
      📝 Fill in your name, student name, date, and signature to complete the form.
    </div>

    <div class="no-print" style="text-align:center;margin-bottom:14px">
      <button onclick="window.print()" style="padding:12px 32px;background:linear-gradient(135deg,#1c3557,#3b6fba);color:white;border:none;border-radius:10px;font-family:inherit;font-size:15px;font-weight:800;cursor:pointer;box-shadow:0 4px 18px rgba(28,53,87,0.28)">
        🖨️ Print / Save as PDF
      </button>
    </div>

    <div style="margin-top:8px;font-size:12px;color:#7c6f5e;text-align:center;font-style:italic">
      Please email the signed PDF to your teacher.
    </div>
  </div>
</div>` : `
<div style="margin-top:32px;padding:16px 20px;background:#d1fae5;border-radius:14px;border:2px solid #6ee7b7;font-size:13px;color:#065f46;font-weight:700">
  ✓ All tools on this disclosure are District Approved — no parental signature is required.
</div>`}

<div style="margin-top:24px;overflow:hidden;font-size:11px;color:#b0a598;border-top:1px solid #e2ddd5;padding-top:14px">
  <span style="float:left">Generated by County EdTech Privacy Disclosure Tool</span>
  <span style="float:right">${new Date().toLocaleDateString()}</span>
  <div style="clear:both"></div>
</div>

<script>
// ── Signature canvas ──────────────────────────────────────────────
var sigCanvas = document.getElementById('sigCanvas');
var ctx = sigCanvas.getContext('2d');
var drawing = false, lastX = 0, lastY = 0;

function getPos(e) {
  var r = sigCanvas.getBoundingClientRect();
  var sx = sigCanvas.width / r.width, sy = sigCanvas.height / r.height;
  if (e.touches) return { x: (e.touches[0].clientX - r.left)*sx, y: (e.touches[0].clientY - r.top)*sy };
  return { x: (e.clientX - r.left)*sx, y: (e.clientY - r.top)*sy };
}
sigCanvas.addEventListener('mousedown', function(e){ drawing=true; var p=getPos(e); lastX=p.x; lastY=p.y; });
sigCanvas.addEventListener('mousemove', function(e){ if(!drawing) return; var p=getPos(e); ctx.beginPath(); ctx.moveTo(lastX,lastY); ctx.lineTo(p.x,p.y); ctx.strokeStyle='#1c3557'; ctx.lineWidth=2.5; ctx.lineCap='round'; ctx.lineJoin='round'; ctx.stroke(); lastX=p.x; lastY=p.y; updateStatus(); });
sigCanvas.addEventListener('mouseup', function(){ drawing=false; });
sigCanvas.addEventListener('mouseleave', function(){ drawing=false; });
sigCanvas.addEventListener('touchstart', function(e){ e.preventDefault(); drawing=true; var p=getPos(e); lastX=p.x; lastY=p.y; }, {passive:false});
sigCanvas.addEventListener('touchmove', function(e){ e.preventDefault(); if(!drawing) return; var p=getPos(e); ctx.beginPath(); ctx.moveTo(lastX,lastY); ctx.lineTo(p.x,p.y); ctx.strokeStyle='#1c3557'; ctx.lineWidth=2.5; ctx.lineCap='round'; ctx.lineJoin='round'; ctx.stroke(); lastX=p.x; lastY=p.y; updateStatus(); }, {passive:false});
sigCanvas.addEventListener('touchend', function(e){ e.preventDefault(); drawing=false; updateStatus(); }, {passive:false});

function clearSig() {
  ctx.clearRect(0,0,sigCanvas.width,sigCanvas.height);
  document.getElementById('sigStatus').textContent = 'Draw your signature above';
  document.getElementById('sigStatus').style.color = '#9c8e81';
  updateStatus();
}

// ── Per-resource initials ─────────────────────────────────────────
function updateInitialStatus(input, statusId) {
  var el = document.getElementById(statusId);
  if (input.value.trim()) { el.style.display='inline'; } else { el.style.display='none'; }
  updateStatus();
}

function toggleDecline(container, id) {
  var chk = document.getElementById('chk-'+id);
  var lbl = document.getElementById('chklabel-'+id);
  var isChecked = chk.style.background === 'rgb(28, 53, 87)';
  if (isChecked) {
    chk.style.background = 'white'; chk.textContent = '';
    lbl.style.color = '#7c6f5e';
  } else {
    chk.style.background = '#1c3557'; chk.textContent = '✓';
    lbl.style.color = '#7f1d1d';
  }
  updateStatus();
}

// ── Opt-out checkbox ──────────────────────────────────────────────
var optOutChecked = false;
function toggleOptOut() {
  optOutChecked = !optOutChecked;
  var chk = document.getElementById('optOutChk');
  var box = document.getElementById('optOutBox');
  if (optOutChecked) {
    chk.style.background='#1c3557'; chk.textContent='✓';
    box.style.background='#fef2f2'; box.style.border='1px solid #fca5a5';
  } else {
    chk.style.background='white'; chk.textContent='';
    box.style.background='#f7f5f1'; box.style.border='1px solid transparent';
  }
}

// ── Form completion status ────────────────────────────────────────
function hasSig() {
  var d = ctx.getImageData(0,0,sigCanvas.width,sigCanvas.height).data;
  for (var i=3; i<d.length; i+=4) { if (d[i] > 0) return true; }
  return false;
}
function updateStatus() {
  var pn = (document.getElementById('parentName')||{}).value || '';
  var sn = (document.getElementById('studentName')||{}).value || '';
  var dt = (document.getElementById('sigDate')||{}).value || '';
  var sig = hasSig();
  var status = document.getElementById('formStatus');
  if (!status) return;
  if (pn.trim() && sn.trim() && dt && sig) {
    status.style.background='#d1fae5'; status.style.color='#065f46';
    status.textContent = '\u2705 Form complete \u2014 click Print / Save as PDF below.';
    document.getElementById('sigStatus').textContent = '\u2713 Signature captured';
    document.getElementById('sigStatus').style.color = '#059669';
  } else {
    status.style.background='#fffbeb'; status.style.color='#92400e';
    var missing = [];
    if (!pn.trim()) missing.push('parent name');
    if (!sn.trim()) missing.push('student name');
    if (!dt) missing.push('date');
    if (!sig) missing.push('signature');
    status.textContent = '\u{1F4DD} Still needed: ' + missing.join(', ') + '.';
  }
}
document.getElementById('parentName').addEventListener('input', updateStatus);
document.getElementById('studentName').addEventListener('input', updateStatus);
document.getElementById('sigDate').addEventListener('input', updateStatus);
<\/script>
</body>
</html>`;
  };

  const handleDownloadPDF = () => {
    const html = buildHTMLDoc(selectedList, analyses, teacherInfo);
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const safeName = teacherInfo.name ? teacherInfo.name.replace(/\s+/g, "_") + "_" : "";
    a.href = url;
    a.download = `${safeName}EdTech_Privacy_Disclosure.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Load persisted data — with private→shared migration for analyses
  useEffect(() => {
    (async () => {
      try {
        const r = await window.storage.get(RESOURCES_KEY);
        if (r) {
          const stored = JSON.parse(r.value);
          const defaultMap = Object.fromEntries(DEFAULT_RESOURCES.map(d => [d.id, d.label]));
          const merged = stored.map(res => (!res.label && defaultMap[res.id]) ? { ...res, label: defaultMap[res.id] } : res);
          setResources(sortResources(merged));
        } else {
          setResources(sortResources(DEFAULT_RESOURCES));
        }
      } catch { setResources(sortResources(DEFAULT_RESOURCES)); }

      try {
        // Load shared (public) analyses first, then fill gaps from private (legacy single-key fallback)
        let sharedAnalyses = await loadAnalysesChunked(true) || {};
        let privateAnalyses = await loadAnalysesChunked(false) || {};

        // Legacy single-key fallback for old data
        if (!Object.keys(sharedAnalyses).length) {
          try { const r = await window.storage.get(ANALYSES_KEY, true); if (r) sharedAnalyses = JSON.parse(r.value); } catch {}
        }
        if (!Object.keys(privateAnalyses).length) {
          try { const r = await window.storage.get(ANALYSES_KEY); if (r) privateAnalyses = JSON.parse(r.value); } catch {}
        }

        // Merge: shared is authoritative; private fills any gaps
        const merged = { ...sharedAnalyses };
        let addedFromPrivate = false;
        for (const [id, data] of Object.entries(privateAnalyses)) {
          if (!merged[id]?.done && data?.done) { merged[id] = data; addedFromPrivate = true; }
        }
        // If private had new entries, push them to shared so all users see them
        if (addedFromPrivate) {
          try { await saveAnalysesChunked(merged, true); } catch {}
        }

        setAnalyses(merged);

        // Load checklists (shared)
        let loadedChecklists = {};
        try {
          const cl = await window.storage.get(CHECKLIST_KEY, true);
          if (cl) loadedChecklists = JSON.parse(cl.value);
        } catch {}

        // Seed 123 Genius (r907) with policy evaluation answers if not already set
        const GENIUS_ANSWERS = { "6":"Policies may be changed any time at their discretion, without notice to the user","8":"Policies give a broad statement of data collected OR policies are not clear on data collected crucial to app functionality","9":"Policies give a broad statement of how data is collected OR policies are not clear on how data is collected","10":"Policies do not state who owns the data OR policies state supplier owns all data","11":"Policies allow users to delete data entirely after a period of time OR policies state no data collected","12":"Policies do not state its data retention policy OR policies state that data is retained for as long as supplier needs it","14":"Policies give a broad statement on steps taken to protect data OR policies are unclear on how data is protected","15":"Data encrypted throughout OR passes an encryption test with no vulnerabilities OR policies state no data collected","16":"Supplier enforces strong password creation OR supplier user base exempt from password requirements OR no account creation required","17":"Supplier uses SSO or an LTI launch OR no account creation is required OR supplier user base exempt from 2-step authentication requirements","18":"Policies give a broad statement on the use of cookies OR policies are unclear if cookies are crucial for app functionality","20":"Policies list each third party separately OR policies state third party use strictly for app functionality OR policies state that they do not use third parties","21":"Policies list the data it shares with each third party separately OR policies state that it does not share any data with any third party","22":"Policies include an easy opt out process for users OR policies state that it does not share any data with any third party","23":"Supplier claims responsibility for third party privacy practices OR policies state that it does not share any data with any third party","24":"Supplier changes third party and keeps the same data sharing terms OR supplier does not use any third parties","26":"No ads are displayed","27":"Policies guarantee no ad targeting OR policies state no ads are used on its platform","28":"Policies state that third parties might track or collect user data but gives you the option to opt out OR users can opt out of ad networks but not clear if user can opt out of all ads or tracking across web","29":"Policies state that it only tracks interactions within its application OR policies state that it does not use any tracking technologies for ads","30":"Policies state in detail how users can opt out of sharing data with advertisers OR policies state no ads are used on its platform" };
        const existingGenius = loadedChecklists["r907"] || { steps: {}, overallStatus: "pending", finalNote: "", lastUpdated: "" };
        const existingStep4 = existingGenius.steps?.["4"] || { items: {}, answers: {}, note: "" };
        const existingAnswers = existingStep4.answers || {};
        const hasAnyAnswer = Object.keys(existingAnswers).length > 0;
        if (!hasAnyAnswer) {
          const seededStep4 = { ...existingStep4, answers: GENIUS_ANSWERS };
          loadedChecklists = { ...loadedChecklists, r907: { ...existingGenius, steps: { ...(existingGenius.steps || {}), "4": seededStep4 }, lastUpdated: new Date().toISOString() } };
          try { await window.storage.set(CHECKLIST_KEY, JSON.stringify(loadedChecklists), true); } catch {}
        }
        setChecklists(loadedChecklists);
      } catch {}
    })();
  }, []);

  const persistResources = useCallback(async (updated) => {
    const sorted = sortResources(updated);
    setResources(sorted);
    try { await window.storage.set(RESOURCES_KEY, JSON.stringify(sorted)); } catch {}
  }, []);

  const persistAnalyses = useCallback(async (updated) => {
    setAnalyses(updated);
    try { await saveAnalysesChunked(updated, true); } catch {}
  }, []);

  const syncToPublic = useCallback(async (currentAnalyses) => {
    const count = Object.values(currentAnalyses).filter(a => a?.done).length;
    if (count === 0) {
      alert("⚠️ Nothing to sync — 0 analyses in memory. Run analyses first, then sync.");
      return;
    }
    setSyncing(true);
    try {
      const payload = JSON.stringify(currentAnalyses);
      const sizeMB = (new Blob([payload]).size / 1024 / 1024).toFixed(2);
      const numChunks = await saveAnalysesChunked(currentAnalyses, true);
      setLastSynced({ time: new Date(), count, sizeMB, numChunks });
      setStorageInfo(null); // clear diagnostic so next check reflects new state
    } catch(e) {
      alert("Sync failed: " + e.message);
    } finally {
      setSyncing(false);
    }
  }, []);

  const handleExportAnalyses = () => {
    const count = Object.values(analyses).filter(a => a?.done).length;
    if (count === 0) { alert("No analyses in memory to export."); return; }
    const json = JSON.stringify(analyses, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `edtech-analyses-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  };

  const handleExportComplianceCSV = () => {
    const analyzed = DEFAULT_RESOURCES.filter(r => analyses[r.id]?.done);
    if (analyzed.length === 0) { alert("No completed analyses to export. Run analyses first."); return; }

    const QUESTIONS = [
      "GENQ1","DCQ1","DCQ2","DCQ3","DCQ4","DCQ5",
      "SECQ1","SECQ2","SECQ3","SECQ4","SECQ5",
      "SHRQ1","SHRQ2","SHRQ3","SHRQ4","SHRQ5",
      "ADVQ1","ADVQ2","ADVQ3","ADVQ4","ADVQ5"
    ];
    const QUESTION_LABELS = {
      GENQ1: "Policy Change Mgmt",
      DCQ1: "Lists Data Collected", DCQ2: "How Data Collected", DCQ3: "Data Ownership",
      DCQ4: "Data Deletion", DCQ5: "Data Retention",
      SECQ1: "Data Protection", SECQ2: "Encryption", SECQ3: "Password Enforcement",
      SECQ4: "Multi-Factor Auth", SECQ5: "Cookie Policy",
      SHRQ1: "3rd Party Disclosure", SHRQ2: "Data Shared Per 3rd Party", SHRQ3: "Opt Out 3rd Party",
      SHRQ4: "3rd Party Bound by Agreement", SHRQ5: "Notify 3rd Party Changes",
      ADVQ1: "Ads Displayed", ADVQ2: "Targeted Advertising", ADVQ3: "3rd Party Ad Tracking",
      ADVQ4: "Web Beacons/Tracking", ADVQ5: "Opt Out Ad Data Sharing"
    };
    const REGULATORY_MAP = {
      GENQ1: "FERPA",
      DCQ1: "FERPA", DCQ2: "FERPA", DCQ3: "FERPA", DCQ4: "FERPA/COPPA", DCQ5: "FERPA",
      SECQ1: "FERPA", SECQ2: "FERPA", SECQ3: "FERPA", SECQ4: "FERPA", SECQ5: "CIPA",
      SHRQ1: "FERPA/COPPA", SHRQ2: "FERPA/COPPA", SHRQ3: "FERPA/COPPA",
      SHRQ4: "FERPA/COPPA", SHRQ5: "FERPA/COPPA",
      ADVQ1: "COPPA/CIPA", ADVQ2: "COPPA/CIPA", ADVQ3: "COPPA/CIPA",
      ADVQ4: "COPPA/CIPA", ADVQ5: "COPPA/CIPA"
    };
    const scoreNum = (v) => v === "Meets" ? 2 : v === "Partially" ? 1 : v === "Not Met" ? 0 : "";

    // Header row
    const headerMeta = ["Resource_ID","Resource_Name","Category","Label","Risk_Level",
      "Account_Required","Min_Age","COPPA_Compliant","FERPA_Compliant","Student_Data_Sold",
      "TOS_URL","Privacy_Policy_URL"];
    const headerQText  = QUESTIONS.map(q => `${q}_Rating`);
    const headerQNum   = QUESTIONS.map(q => `${q}_Score`);
    const headerQReg   = QUESTIONS.map(q => `${q}_Regulation`);
    const headerQLabel = QUESTIONS.map(q => `${q}_Question`);
    const headerQNote  = QUESTIONS.map(q => `${q}_Notes`);

    const rows = [
      [...headerMeta, ...headerQLabel, ...headerQReg, ...headerQText, ...headerQNum, ...headerQNote]
    ];

    for (const r of analyzed) {
      const a = analyses[r.id];
      const comp = a.compliance || {};
      const notes = a.complianceNotes || {};

      const meta = [
        r.id, r.name, r.category || "", r.label || "",
        a.riskLevel || "", a.accountRequired ?? "", a.minAge || "",
        a.coppaCompliant ?? "", a.ferpaCompliant ?? "", a.studentDataSold ?? "",
        a.tosUrl || "", a.ppUrl || ""
      ];

      const qLabels  = QUESTIONS.map(q => QUESTION_LABELS[q] || q);
      const qRegs    = QUESTIONS.map(q => REGULATORY_MAP[q] || "");
      const qRatings = QUESTIONS.map(q => comp[q] || "");
      const qScores  = QUESTIONS.map(q => scoreNum(comp[q]));
      const qNotes   = QUESTIONS.map(q => (notes[q] || "").replace(/"/g, '""'));

      rows.push([...meta, ...qLabels, ...qRegs, ...qRatings, ...qScores, ...qNotes]);
    }

    // Escape and join
    const csv = rows.map(row =>
      row.map(cell => {
        const s = String(cell ?? "");
        return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s}"` : s;
      }).join(",")
    ).join("\n");

    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `edtech-compliance-data-${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  };

  const handleImportAnalyses = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportMsg({ type: "loading", text: "Reading file…" });
    try {
      const text = await file.text();
      const imported = JSON.parse(text);
      const count = Object.values(imported).filter(a => a?.done).length;
      if (count === 0) { setImportMsg({ type: "error", text: "File contained 0 completed analyses." }); return; }
      // Merge with existing — imported wins for any resource already in memory
      const merged = { ...analyses, ...imported };
      await persistAnalyses(merged);
      await syncToPublic(merged);
      setImportMsg({ type: "success", text: `✅ Imported ${count} analyses and synced to public storage.` });
    } catch(err) {
      setImportMsg({ type: "error", text: "Import failed: " + err.message });
    }
    // Reset file input so same file can be re-imported
    if (importFileRef.current) importFileRef.current.value = "";
  };

  const pf = (field, val) => setParentForm(p => ({ ...p, [field]: val }));
  const pfInitial = (id, val) => setParentForm(p => ({ ...p, initials: { ...p.initials, [id]: { ...p.initials[id], initial: val } } }));
  const pfDecline = (id, val) => setParentForm(p => ({ ...p, initials: { ...p.initials, [id]: { ...p.initials[id], declined: val } } }));

  const persistChecklists = async (updated) => {
    setChecklists(updated);
    try { await window.storage.set(CHECKLIST_KEY, JSON.stringify(updated), true); } catch(e) { console.error("checklist save error", e); }
  };

  const updateChecklistStep = async (resourceId, stepNum, field, value, reviewerName) => {
    const existing = checklists[resourceId] || { steps: {}, overallStatus: "pending", finalNote: "", lastUpdated: "" };
    const existingStep = existing.steps?.[stepNum] || { items: {}, answers: {}, meta: {}, note: "" };
    let updatedStep;
    if (field.startsWith("items.")) {
      const itemIdx = field.split(".")[1];
      updatedStep = { ...existingStep, items: { ...(existingStep.items || {}), [itemIdx]: value } };
      // Record who answered and when (clear meta if toggling answer off)
      const metaEntry = value == null ? null : { by: reviewerName || "Unknown", at: new Date().toISOString() };
      updatedStep = { ...updatedStep, meta: { ...(existingStep.meta || {}), [itemIdx]: metaEntry } };
    } else if (field.startsWith("answers.")) {
      const itemIdx = field.split(".")[1];
      updatedStep = { ...existingStep, answers: { ...(existingStep.answers || {}), [itemIdx]: value } };
    } else if (field.startsWith("meta.")) {
      const itemIdx = field.split(".")[1];
      updatedStep = { ...existingStep, meta: { ...(existingStep.meta || {}), [itemIdx]: value } };
    } else {
      updatedStep = { ...existingStep, [field]: value };
    }
    const updated = {
      ...checklists,
      [resourceId]: {
        ...existing,
        steps: { ...(existing.steps || {}), [stepNum]: updatedStep },
        lastUpdated: new Date().toISOString(),
      }
    };
    await persistChecklists(updated);
  };

  const updateChecklistMeta = async (resourceId, field, value) => {
    const updated = {
      ...checklists,
      [resourceId]: {
        ...(checklists[resourceId] || { steps: {}, overallStatus: "pending", finalNote: "", lastUpdated: "" }),
        [field]: value,
        lastUpdated: new Date().toISOString(),
      }
    };
    await persistChecklists(updated);
  };

  const getSigPos = (e, canvas) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if (e.touches) {
      return { x: (e.touches[0].clientX - rect.left) * scaleX, y: (e.touches[0].clientY - rect.top) * scaleY };
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  };

  const sigStart = (e) => {
    e.preventDefault();
    const canvas = sigCanvasRef.current; if (!canvas) return;
    sigDrawing.current = true;
    sigLastPos.current = getSigPos(e, canvas);
  };

  const sigMove = (e) => {
    e.preventDefault();
    if (!sigDrawing.current) return;
    const canvas = sigCanvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const pos = getSigPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(sigLastPos.current.x, sigLastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = "#1c3557";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
    sigLastPos.current = pos;
  };

  const sigEnd = (e) => {
    e.preventDefault();
    sigDrawing.current = false;
    const canvas = sigCanvasRef.current;
    if (canvas) pf("signatureDataUrl", canvas.toDataURL());
  };

  const clearSig = () => {
    const canvas = sigCanvasRef.current; if (!canvas) return;
    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
    pf("signatureDataUrl", "");
  };

  const runStorageDiag = async () => {
    setDiagLoading(true);
    const info = { inMemory: Object.values(analyses).filter(a => a?.done).length };

    // Check shared chunked
    try {
      const m = await window.storage.get(`${ANALYSES_KEY}-chunks`, true);
      if (m) {
        const n = parseInt(m.value, 10);
        info.sharedChunks = n;
        let total = 0;
        for (let i = 0; i < n; i++) {
          try {
            const c = await window.storage.get(`${ANALYSES_KEY}-chunk-${i}`, true);
            if (c) total += Object.keys(JSON.parse(c.value)).length;
          } catch {}
        }
        info.sharedChunkEntries = total;
      } else { info.sharedChunks = 0; info.sharedChunkEntries = 0; }
    } catch { info.sharedChunks = 0; info.sharedChunkEntries = 0; }

    // Check legacy shared single key
    try {
      const r = await window.storage.get(ANALYSES_KEY, true);
      info.sharedLegacyEntries = r ? Object.keys(JSON.parse(r.value)).length : 0;
      info.sharedLegacySizeKB = r ? Math.round(new Blob([r.value]).size / 1024) : 0;
    } catch { info.sharedLegacyEntries = 0; info.sharedLegacySizeKB = 0; }

    // Check legacy private single key
    try {
      const r = await window.storage.get(ANALYSES_KEY);
      info.privateLegacyEntries = r ? Object.keys(JSON.parse(r.value)).length : 0;
    } catch { info.privateLegacyEntries = 0; }

    setStorageInfo(info);
    setDiagLoading(false);
  };

  // Analyze a single resource (force=true skips the done check for re-analysis)
  const handleAnalyze = async (resource, force = false) => {
    if (!force && analyses[resource.id]?.done) return;
    setAnalyzing(a => ({ ...a, [resource.id]: true }));
    setAnalyzeError(e => ({ ...e, [resource.id]: null }));
    try {
      const result = await analyzeResource(resource);
      const updated = { ...analyses, [resource.id]: { ...result, done: true, analyzedAt: new Date().toISOString() } };
      await persistAnalyses(updated);
      syncToPublic(updated);
    } catch (err) {
      console.error("Analysis error for", resource.name, err);
      setAnalyzeError(e => ({ ...e, [resource.id]: err.message || "Analysis failed — try again." }));
    }
    setAnalyzing(a => ({ ...a, [resource.id]: false }));
  };

  const handleReanalyzeAll = async () => {
    bulkCancelRef.current = false;
    setBulkAnalyzing(true);
    setBulkProgress({ current: 0, total: resources.length, currentName: "" });
    let currentAnalyses = { ...analyses };
    for (let i = 0; i < resources.length; i++) {
      if (bulkCancelRef.current) break;
      const resource = resources[i];
      setBulkProgress({ current: i + 1, total: resources.length, currentName: resource.name });
      setAnalyzing(a => ({ ...a, [resource.id]: true }));
      setAnalyzeError(e => ({ ...e, [resource.id]: null }));
      try {
        const result = await analyzeResource(resource);
        currentAnalyses = { ...currentAnalyses, [resource.id]: { ...result, done: true, analyzedAt: new Date().toISOString() } };
        await persistAnalyses(currentAnalyses);
        syncToPublic(currentAnalyses);
        // Pause 3s between calls to respect rate limits
        await new Promise(r => setTimeout(r, 3000));
      } catch (err) {
        setAnalyzeError(e => ({ ...e, [resource.id]: err.message || "Failed" }));
        // On rate limit, stop bulk analysis — user must retry later
        if (err.message?.includes("Rate limit")) {
          bulkCancelRef.current = true;
        } else {
          await new Promise(r => setTimeout(r, 2000));
        }
      }
      setAnalyzing(a => ({ ...a, [resource.id]: false }));
    }
    setBulkAnalyzing(false);
    setBulkProgress({ current: 0, total: 0, currentName: "" });
  };

  // Admin auth (simple password — "admin123" for demo)
  const handleAdminLogin = () => {
    if (adminPassInput === "admin123") {
      setAdminMode(true);
      setAdminPassError(false);
      loadSuggestions();
    } else {
      setAdminPassError(true);
    }
    setAdminPassInput("");
  };

  // Add resource (admin)
  const handleAddResource = async () => {
    if (!newRes.name.trim() || !newRes.url.trim()) return;
    setSavingRes(true);
    const resource = {
      id: "r_" + Date.now(),
      name: newRes.name.trim(),
      url: newRes.url.trim().startsWith("http") ? newRes.url.trim() : "https://" + newRes.url.trim(),
      category: newRes.category.trim() || "Other",
      label: newRes.label || "",
    };
    await persistResources([...resources, resource]);
    setNewRes({ name: "", url: "", category: "", label: "" });
    setAddingRes(false);
    setSavingRes(false);
  };

  const handleRemoveResource = async (id) => {
    await persistResources(resources.filter(r => r.id !== id));
    const updated = { ...analyses };
    delete updated[id];
    await persistAnalyses(updated);
    setSelected(s => { const ns = { ...s }; delete ns[id]; return ns; });
  };

  const selectedList = [...resources].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })).filter(r => selected[r.id]);
  const categories = ["All", ...Array.from(new Set(resources.map(r => r.category).filter(Boolean))).sort()];

  const filteredResources = [...resources].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })).filter(r => {
    if (selected[r.id] && showSelectedOnly) return true; // in selected-only mode, show checked regardless of other filters
    if (showSelectedOnly) return false; // hide unchecked when in selected-only mode
    if (selected[r.id]) return true; // always show checked resources
    const ms = r.name.toLowerCase().includes(search.toLowerCase());
    const mc = categoryFilter === "All" || r.category === categoryFilter;
    const ml = labelFilters.size === 0 || labelFilters.has(r.label || "");
    return ms && mc && ml;
  });

  const handleBulkAnalyzeAll = async (labelFilter = null) => {
    const toAnalyze = resources.filter(r => !analyses[r.id]?.done && (labelFilter === null || r.label === labelFilter));
    if (toAnalyze.length === 0) { alert(`No unanalyzed resources found${labelFilter ? ` with label "${labelFilter}"` : ""}.`); return; }
    bulkCancelRef.current = false;
    setBulkAnalyzing(true);
    setBulkProgress({ current: 0, total: toAnalyze.length, currentName: "" });
    let currentAnalyses = { ...analyses };
    for (let i = 0; i < toAnalyze.length; i++) {
      if (bulkCancelRef.current) break;
      const resource = toAnalyze[i];
      setBulkProgress({ current: i + 1, total: toAnalyze.length, currentName: resource.name });
      setAnalyzing(a => ({ ...a, [resource.id]: true }));
      setAnalyzeError(e => ({ ...e, [resource.id]: null }));
      try {
        const result = await analyzeResource(resource);
        currentAnalyses = { ...currentAnalyses, [resource.id]: { ...result, done: true, analyzedAt: new Date().toISOString() } };
        await persistAnalyses(currentAnalyses);
        syncToPublic(currentAnalyses);
        // Pause 3s between calls to respect rate limits
        await new Promise(r => setTimeout(r, 3000));
      } catch (err) {
        setAnalyzeError(e => ({ ...e, [resource.id]: err.message || "Failed" }));
        // On rate limit, stop bulk analysis — user must retry later
        if (err.message?.includes("Rate limit")) {
          bulkCancelRef.current = true;
        } else {
          await new Promise(r => setTimeout(r, 2000));
        }
      }
      setAnalyzing(a => ({ ...a, [resource.id]: false }));
    }
    setBulkAnalyzing(false);
    setBulkProgress({ current: 0, total: 0, currentName: "" });
  };

  const analyzeAll = async () => {
    for (const r of selectedList) {
      if (!analyses[r.id]?.done && !analyzing[r.id]) {
        await handleAnalyze(r);
      }
    }
  };

  // ── RENDER ──────────────────────────────────────────────────────────────────
  // ── Submit a tool suggestion ───────────────────────────────────────────
  const submitSuggestion = async () => {
    if (!suggestName.trim() || !suggestUrl.trim()) {
      alert("Please enter both a tool name and website URL.");
      return;
    }
    setSuggestStatus("loading");
    try {
      const res = await fetch("/.netlify/functions/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: suggestName.trim(), url: suggestUrl.trim(), note: suggestNote.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Submission failed");
      setSuggestStatus({ success: true, analysis: data.analysis, name: suggestName.trim() });
    } catch (err) {
      setSuggestStatus({ error: err.message });
    }
  };

  const loadSuggestions = async () => {
    try {
      const res = await fetch("/.netlify/functions/suggestions");
      const data = await res.json();
      setPendingSuggestions(data.suggestions || []);
      setSuggestionsLoaded(true);
    } catch {}
  };

  const approveSuggestion = async (s) => {
    // Add to localStorage as approved resource
    const existing = JSON.parse(localStorage.getItem("etpt-approved-suggestions") || "[]");
    existing.push({ id: s.id, name: s.name, url: s.url, category: s.category || "Other",
      label: "APPROVED", approvedAt: new Date().toISOString() });
    localStorage.setItem("etpt-approved-suggestions", JSON.stringify(existing));
    // Mark approved on server
    await fetch("/.netlify/functions/approve-suggestion", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: s.id, action: "approve" })
    });
    setPendingSuggestions(p => p.filter(x => x.id !== s.id));
    // Reload resources to include newly approved
    const approvedExtra = JSON.parse(localStorage.getItem("etpt-approved-suggestions") || "[]");
    setResources(sortResources([...DEFAULT_RESOURCES, ...approvedExtra]));
  };

  const denySuggestion = async (s) => {
    await fetch("/.netlify/functions/approve-suggestion", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: s.id, action: "deny" })
    });
    setPendingSuggestions(p => p.filter(x => x.id !== s.id));
  };


  return (
    <div style={{ minHeight: "100vh", background: "#f0ece4", fontFamily: "'Palatino Linotype', Palatino, Georgia, serif" }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        .card { animation: fadeIn 0.3s ease both; }
        .resource-card:hover { transform: translateY(-2px); box-shadow: 0 8px 28px rgba(0,0,0,0.10) !important; }
        .tab-btn { transition: all 0.18s; }
        .tab-btn:hover { opacity: 0.85; }
        .check-card { transition: all 0.18s; cursor: pointer; }
        .check-card:hover { border-color: #3b6fba !important; }
        .btn-primary { transition: all 0.18s; }
        .btn-primary:hover { opacity: 0.88; transform: translateY(-1px); }
        input:focus, select:focus, textarea:focus { outline: 2px solid #3b6fba; outline-offset: 1px; }
        @media print {
          body { background: white !important; }
        }
      `}</style>

      {/* ── APP SHELL (hidden on print) ─────────────────────────────────────── */}
      <div id="app-shell">
        {/* Header */}
        <header style={{ background: "linear-gradient(135deg, #1c3557 0%, #2b5592 100%)", color: "white", boxShadow: "0 4px 24px rgba(0,0,0,0.22)" }}>
          <div style={{ maxWidth: 1120, margin: "0 auto", padding: "20px 28px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
              <div style={{ fontSize: 36, lineHeight: 1 }}>🏫</div>
              <div>
                <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: "-0.4px", lineHeight: 1.2 }}>
                  EdTech Privacy Disclosure Tool
                </h1>
                <p style={{ margin: "3px 0 0", opacity: 0.72, fontSize: 13 }}>
                  County resource library · AI-powered policy analysis · Printable syllabus attachment
                </p>
              </div>
            </div>
            {/* Tabs */}
            <div style={{ display: "flex", gap: 6 }}>
              {[
                { id: "teacher", label: "👩‍🏫 Teacher View" },
                { id: "admin", label: "🔐 Admin" },
                { id: "compliance", label: "📋 Compliance" },
                { id: "pdf", label: `📄 PDF Preview${selectedList.length ? ` (${selectedList.length})` : ""}` },
              ].map(t => (
                <button key={t.id} className="tab-btn" onClick={() => setView(t.id)}
                  style={{ padding: "8px 18px", borderRadius: 8, border: "none", cursor: "pointer",
                    fontFamily: "inherit", fontSize: 13, fontWeight: 700,
                    background: view === t.id ? "white" : "rgba(255,255,255,0.13)",
                    color: view === t.id ? "#1c3557" : "white" }}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </header>

        <main style={{ maxWidth: 1120, margin: "0 auto", padding: "32px 28px" }}>

          {/* ════════════════════════════════════════════════════
              TEACHER VIEW
          ════════════════════════════════════════════════════ */}
          {view === "teacher" && (
            <div>
              {/* Teacher Info Panel */}
              <div className="card" style={{ background: "white", borderRadius: 16, padding: 24, marginBottom: 24, boxShadow: "0 2px 14px rgba(0,0,0,0.06)", border: "1px solid #e2ddd5" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
                  <h2 style={{ margin: 0, fontSize: 16, color: "#1c3557", fontWeight: 700 }}>📋 Your Information</h2>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button onClick={() => setShowFerpa(true)} style={{ fontSize: 11, fontWeight: 700, color: "#3b6fba", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 20, padding: "4px 11px", cursor: "pointer" }}>⚖️ FERPA</button>
                    <button onClick={() => setShowCoppa(true)} style={{ fontSize: 11, fontWeight: 700, color: "#7c3aed", background: "#f5f3ff", border: "1px solid #ddd6fe", borderRadius: 20, padding: "4px 11px", cursor: "pointer" }}>🛡️ COPPA</button>
                    <button onClick={() => setShowCipa(true)} style={{ fontSize: 11, fontWeight: 700, color: "#065f46", background: "#ecfdf5", border: "1px solid #6ee7b7", borderRadius: 20, padding: "4px 11px", cursor: "pointer" }}>🌐 CIPA</button>
                    <button onClick={() => setShowClassroomVsExtra(true)} style={{ fontSize: 11, fontWeight: 700, color: "#92400e", background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 20, padding: "4px 11px", cursor: "pointer" }}>🏫 Classroom vs. Extracurricular</button>
                    <button onClick={() => setShowApprovalProcess(true)} style={{ fontSize: 11, fontWeight: 700, color: "#0f766e", background: "#f0fdfa", border: "1px solid #5eead4", borderRadius: 20, padding: "4px 11px", cursor: "pointer" }}>✅ Approving a New Resource</button>
                    <button onClick={() => { setShowSuggestModal(true); setSuggestStatus(null); setSuggestName(""); setSuggestUrl(""); setSuggestNote(""); }} style={{ fontSize: 11, fontWeight: 700, color: "#7c3aed", background: "#f5f3ff", border: "1px solid #ddd6fe", borderRadius: 20, padding: "4px 11px", cursor: "pointer" }}>💡 Suggest a Tool</button>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(185px, 1fr))", gap: 12 }}>
                  {[["name","Teacher Name"],["subject","Subject / Course"],["grade","Grade Level"],["school","School Name"],["principal","Principal's Name"],["year","School Year"]].map(([k, label]) => (
                    <label key={k} style={{ display: "block" }}>
                      <span style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#7c6f5e", textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 5 }}>{label}</span>
                      <input value={teacherInfo[k]} onChange={e => setTeacherInfo(t => ({ ...t, [k]: e.target.value }))}
                        placeholder={label}
                        style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #d4cfc7", fontFamily: "inherit", fontSize: 14, background: "#faf8f5", boxSizing: "border-box" }} />
                    </label>
                  ))}
                </div>
              </div>

              {/* Search + Filter + Count */}
              <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Search resources…"
                  style={{ flex: 1, minWidth: 180, padding: "10px 14px", borderRadius: 10, border: "1px solid #d4cfc7", fontFamily: "inherit", fontSize: 14, background: "white" }} />
                <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
                  style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #d4cfc7", fontFamily: "inherit", fontSize: 14, background: "white" }}>
                  {categories.map(c => <option key={c}>{c}</option>)}
                </select>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                  <button onClick={() => setLabelFilters(new Set())}
                    style={{ padding: "7px 14px", borderRadius: 20, border: `2px solid ${labelFilters.size === 0 ? "#1c3557" : "#d4cfc7"}`, background: labelFilters.size === 0 ? "#1c3557" : "white", color: labelFilters.size === 0 ? "white" : "#7c6f5e", fontFamily: "inherit", fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
                    All Labels
                  </button>
                  {LABELS.map(l => {
                    const active = labelFilters.has(l);
                    const ls = LABEL_STYLES[l] || { bg: "#f3f4f6", text: "#374151", border: "#d1d5db" };
                    return (
                      <button key={l} onClick={() => setLabelFilters(prev => {
                        const next = new Set(prev);
                        if (next.has(l)) next.delete(l); else next.add(l);
                        return next;
                      })}
                        style={{ padding: "7px 14px", borderRadius: 20, border: `2px solid ${active ? ls.border : "#d4cfc7"}`, background: active ? ls.bg : "white", color: active ? ls.text : "#7c6f5e", fontFamily: "inherit", fontSize: 12, fontWeight: active ? 800 : 600, cursor: "pointer", whiteSpace: "nowrap", transition: "all 0.12s" }}>
                        {l}
                      </button>
                    );
                  })}
                </div>
                <button onClick={() => {
                  const allSelected = resources.every(r => selected[r.id]);
                  if (allSelected) {
                    setSelected({});
                  } else {
                    setSelected(Object.fromEntries(resources.map(r => [r.id, true])));
                  }
                }}
                  style={{ padding: "10px 16px", borderRadius: 10, border: "1.5px solid #3b6fba", background: resources.every(r => selected[r.id]) ? "#3b6fba" : "white", color: resources.every(r => selected[r.id]) ? "white" : "#3b6fba", fontFamily: "inherit", fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
                  {resources.every(r => selected[r.id]) ? "☑ Deselect All" : "☐ Select All"}
                </button>
                {filteredResources.length < resources.length && (
                  <button onClick={() => {
                    const visibleIds = Object.fromEntries(filteredResources.map(r => [r.id, true]));
                    setSelected(s => ({ ...s, ...visibleIds }));
                  }}
                    style={{ padding: "10px 16px", borderRadius: 10, border: "1.5px solid #7c6f5e", background: "white", color: "#7c6f5e", fontFamily: "inherit", fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
                    ☐ Select Visible ({filteredResources.length})
                  </button>
                )}
                {selectedList.length > 0 && (
                  <button className="btn-primary" onClick={analyzeAll}
                    style={{ padding: "10px 18px", borderRadius: 10, border: "none", background: "#3b6fba", color: "white", fontFamily: "inherit", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 7 }}>
                    🔍 Analyze All Selected
                  </button>
                )}
                <div style={{ padding: "10px 16px", borderRadius: 10, background: "#1c3557", color: "white", fontSize: 13, fontWeight: 700 }}>
                  ✅ {selectedList.length} selected
                </div>
                <button
                  onClick={() => setShowSelectedOnly(s => !s)}
                  style={{ padding: "10px 16px", borderRadius: 10, border: `2px solid ${showSelectedOnly ? "#3b6fba" : "#d4cfc7"}`, background: showSelectedOnly ? "#eff6ff" : "white", color: showSelectedOnly ? "#1e40af" : "#7c6f5e", fontFamily: "inherit", fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
                  {showSelectedOnly ? "☑ Selected Only" : "☐ Selected Only"}
                </button>
                {selectedList.length > 0 && (
                  <button className="btn-primary" onClick={() => setView("pdf")}
                    style={{ padding: "10px 20px", background: "linear-gradient(135deg, #1c3557, #3b6fba)", color: "white", borderRadius: 10, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 14, fontWeight: 800, boxShadow: "0 4px 14px rgba(28,53,87,0.28)", whiteSpace: "nowrap" }}>
                    📄 Generate Syllabus ({selectedList.length})
                  </button>
                )}
              </div>

              {/* Resource Cards */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(330px, 1fr))", gap: 16 }}>
                {filteredResources.slice(0, visibleCount).map(resource => {
                  const analysis = analyses[resource.id];
                  const isSelected = !!selected[resource.id];
                  const isAnalyzing = !!analyzing[resource.id];
                  const err = analyzeError[resource.id];
                  const risk = analysis?.riskLevel;
                  const riskStyle = risk ? RISK[risk] : null;
                  const catColor = CATEGORY_COLORS[resource.category] || CATEGORY_COLORS.Other;

                  return (
                    <div key={resource.id} className="resource-card card check-card"
                      style={{ background: "white", borderRadius: 14, padding: 18, border: `2px solid ${isSelected ? "#3b6fba" : "#e2ddd5"}`,
                        boxShadow: isSelected ? "0 4px 20px rgba(59,111,186,0.13)" : "0 2px 10px rgba(0,0,0,0.05)",
                        transition: "all 0.18s" }}>

                      {/* Card Header */}
                      <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 12 }}>
                        <input type="checkbox" checked={isSelected}
                          onChange={e => setSelected(s => ({ ...s, [resource.id]: e.target.checked }))}
                          style={{ width: 20, height: 20, marginTop: 1, accentColor: "#3b6fba", cursor: "pointer", flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                            <span style={{ fontWeight: 800, fontSize: 15, color: "#1c3557", lineHeight: 1.3 }}>{resource.name}</span>
                            <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: catColor, color: "#333", flexShrink: 0 }}>
                              {resource.category}
                            </span>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 5 }}>
                          {resource.label && (() => {
                            const ls = LABEL_STYLES[resource.label] || { bg: "#f3f4f6", text: "#374151", border: "#d1d5db" };
                            return (
                              <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 20, background: ls.bg, color: ls.text, border: `1px solid ${ls.border}`, letterSpacing: "0.3px" }}>
                                {resource.label}
                              </span>
                            );
                          })()}
                          {(() => {
                            const cl = checklists[resource.id];
                            const status = cl?.overallStatus || "pending";
                            const TOTAL_ITEMS = 24;
                            const checkedItems = cl ? Object.values(cl.steps || {}).reduce((acc, s) => acc + Object.values(s.items || {}).filter(v => v != null).length, 0) : 0;
                            if (!cl || (checkedItems === 0 && !cl.finalNote && !cl.overallStatus)) return null;
                            const statusConfig = {
                              approved: { bg: "#d1fae5", color: "#065f46", label: "✓ District Approved" },
                              denied:   { bg: "#fee2e2", color: "#991b1b", label: "✕ Denied"           },
                              pending:  { bg: "#fef9c3", color: "#854d0e", label: checkedItems > 0 ? `⏳ Review: ${checkedItems}/${TOTAL_ITEMS}` : "⏳ Review Started" },
                            };
                            const sc = statusConfig[status];
                            return (
                              <button onClick={e => { e.stopPropagation(); setViewChecklistResource(resource); }}
                                style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: sc.bg, color: sc.color, border: "none", cursor: "pointer", fontFamily: "inherit" }}>
                                {sc.label} ℹ️
                              </button>
                            );
                          })()}
                          </div>
                          <a href={resource.url} target="_blank" rel="noreferrer"
                            style={{ color: "#3b6fba", fontSize: 12, textDecoration: "none", wordBreak: "break-all" }}
                            onClick={e => e.stopPropagation()}>
                            {resource.url}
                          </a>
                        </div>
                      </div>

                      {/* Analysis Results */}
                      {analysis?.done ? (
                        <div style={{ background: "#f7f5f1", borderRadius: 10, padding: 12, fontSize: 13 }}>
                          {/* Risk Badge */}
                          {riskStyle && (
                            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 20,
                                background: riskStyle.bg, color: riskStyle.text, fontWeight: 700, fontSize: 12 }}>
                                <span style={{ width: 7, height: 7, borderRadius: "50%", background: riskStyle.dot, display: "inline-block" }} />
                                {risk} Risk
                              </span>
                              {analysis.accountRequired !== undefined && (
                                <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 20, background: analysis.accountRequired ? "#fef3c7" : "#d1fae5", color: "#374151" }}>
                                  {analysis.accountRequired ? "Account Required" : "No Account"}
                                </span>
                              )}
                            </div>
                          )}
                          <p style={{ margin: "0 0 8px", color: "#3c3529", lineHeight: 1.6 }}>{analysis.parentSummary}</p>
                          <div style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 12, color: "#6b5f52" }}>
                            {analysis.tosUrl && (
                              <span>📜 <a href={analysis.tosUrl} target="_blank" rel="noreferrer" style={{ color: "#3b6fba" }}>Terms of Service</a></span>
                            )}
                            {analysis.ppUrl && (
                              <span>🔒 <a href={analysis.ppUrl} target="_blank" rel="noreferrer" style={{ color: "#3b6fba" }}>Privacy Policy</a></span>
                            )}
                          </div>
                          <div style={{ marginTop: 6, fontSize: 11, color: "#9c8e81" }}>
                            Analyzed {new Date(analysis.analyzedAt).toLocaleDateString()}
                          </div>
                        </div>
                      ) : err ? (
                        <div style={{ background: "#fef2f2", borderRadius: 10, padding: 10, fontSize: 12, color: "#7f1d1d" }}>
                          ⚠️ {err}
                          <button onClick={() => handleAnalyze(resource)} style={{ marginLeft: 8, color: "#3b6fba", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 12, textDecoration: "underline" }}>Retry</button>
                        </div>
                      ) : (
                        <button onClick={() => handleAnalyze(resource)} disabled={isAnalyzing}
                          style={{ width: "100%", padding: "9px", borderRadius: 8, border: "1.5px solid #3b6fba", background: isAnalyzing ? "#eff4fb" : "white",
                            color: "#3b6fba", cursor: isAnalyzing ? "wait" : "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700,
                            display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "all 0.15s" }}>
                          {isAnalyzing ? <><Spinner size={14} /> Searching & analyzing…</> : "🔍 Analyze Privacy & Terms"}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Infinite scroll sentinel + status */}
              {visibleCount < filteredResources.length ? (
                <div ref={el => {
                  sentinelRef.current = el;
                  if (!el) return;
                  const obs = new IntersectionObserver(entries => {
                    if (entries[0].isIntersecting) setVisibleCount(c => c + 12);
                  }, { rootMargin: "200px" });
                  obs.observe(el);
                  el._obs = obs;
                  return () => obs.disconnect();
                }} style={{ textAlign: "center", padding: "28px 0", color: "#9c8e81", fontSize: 13 }}>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 20px", background: "#f7f5f1", borderRadius: 20, border: "1px solid #e2ddd5" }}>
                    <span style={{ fontSize: 16 }}>↓</span>
                    Showing {Math.min(visibleCount, filteredResources.length)} of {filteredResources.length} resources — scroll to load more
                  </div>
                </div>
              ) : filteredResources.length > 12 ? (
                <div style={{ textAlign: "center", padding: "20px 0", color: "#9c8e81", fontSize: 13 }}>
                  ✓ All {filteredResources.length} resources shown
                </div>
              ) : null}



            </div>
          )}

          {/* ════════════════════════════════════════════════════
              ADMIN VIEW
          ════════════════════════════════════════════════════ */}
          {view === "admin" && (
            <div>
              {!adminMode ? (
                <div className="card" style={{ maxWidth: 400, margin: "60px auto", background: "white", borderRadius: 20, padding: 36, boxShadow: "0 8px 40px rgba(0,0,0,0.10)", border: "1px solid #e2ddd5", textAlign: "center" }}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>🔐</div>
                  <h2 style={{ margin: "0 0 6px", color: "#1c3557", fontSize: 20 }}>Admin Access</h2>
                  <p style={{ margin: "0 0 20px", color: "#7c6f5e", fontSize: 14 }}>Enter the admin password to manage the county resource list.</p>
                  <p style={{ margin: "0 0 16px", color: "#9c8e81", fontSize: 12 }}>Demo password: <strong>admin123</strong></p>
                  <input type="password" value={adminPassInput} onChange={e => setAdminPassInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleAdminLogin()}
                    placeholder="Password" style={{ width: "100%", padding: "11px 14px", borderRadius: 10, border: `1.5px solid ${adminPassError ? "#ef4444" : "#d4cfc7"}`, fontFamily: "inherit", fontSize: 15, boxSizing: "border-box", marginBottom: 12 }} />
                  {adminPassError && <p style={{ color: "#ef4444", fontSize: 13, margin: "0 0 10px" }}>Incorrect password. Try again.</p>}
                  <button className="btn-primary" onClick={handleAdminLogin}
                    style={{ width: "100%", padding: "12px", background: "#1c3557", color: "white", borderRadius: 10, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 15, fontWeight: 700 }}>
                    Sign In
                  </button>
                </div>
              ) : (
                <div>
                  {/* Admin Header */}
                  <div style={{ marginBottom: 24 }}>
                    {/* Title row */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                      <div>
                        <h2 style={{ margin: 0, color: "#1c3557", fontSize: 20, fontWeight: 800 }}>⚙️ Resource Library Management</h2>
                        <p style={{ margin: "4px 0 0", color: "#7c6f5e", fontSize: 13 }}>
                          {resources.length} resources · {Object.values(analyses).filter(a => a?.done).length} analyzed
                        </p>
                      </div>
                      <button onClick={() => setAddingRes(!addingRes)}
                        style={{ padding: "10px 20px", borderRadius: 10, border: "1.5px solid #3b6fba", background: addingRes ? "#3b6fba" : "white", color: addingRes ? "white" : "#3b6fba", fontFamily: "inherit", fontSize: 14, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
                        {addingRes ? "✕ Cancel" : "+ Add Resource"}
                      </button>
                    </div>

                    {/* Row 1 — AI Analysis */}
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", padding: "10px 14px", background: "#f0fdf4", borderRadius: 12, border: "1px solid #bbf7d0", marginBottom: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: "#065f46", textTransform: "uppercase", letterSpacing: "0.6px", marginRight: 4, whiteSpace: "nowrap" }}>🔍 Analysis</span>
                      {!bulkAnalyzing ? (<>
                        <button onClick={() => handleBulkAnalyzeAll(null)}
                          disabled={resources.every(r => analyses[r.id]?.done)}
                          style={{ padding: "8px 14px", borderRadius: 8, border: "1.5px solid #059669", background: resources.every(r => analyses[r.id]?.done) ? "white" : "#059669", color: resources.every(r => analyses[r.id]?.done) ? "#059669" : "white", fontFamily: "inherit", fontSize: 13, fontWeight: 700, cursor: resources.every(r => analyses[r.id]?.done) ? "default" : "pointer", whiteSpace: "nowrap" }}>
                          {resources.every(r => analyses[r.id]?.done) ? "✓ All Analyzed" : `Analyze All (${resources.filter(r => !analyses[r.id]?.done).length} left)`}
                        </button>
                        <select value={adminAnalyzeLabel} onChange={e => setAdminAnalyzeLabel(e.target.value)}
                          style={{ padding: "8px 10px", borderRadius: 8, border: "1.5px solid #3b6fba", fontFamily: "inherit", fontSize: 12, background: "white", color: "#1c3557" }}>
                          {LABELS.map(l => {
                            const count = resources.filter(r => r.label === l && !analyses[r.id]?.done).length;
                            return <option key={l} value={l}>{l} ({count})</option>;
                          })}
                        </select>
                        <button onClick={() => handleBulkAnalyzeAll(adminAnalyzeLabel)}
                          style={{ padding: "8px 14px", borderRadius: 8, border: "1.5px solid #3b6fba", background: "#3b6fba", color: "white", fontFamily: "inherit", fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
                          Analyze Label
                        </button>
                        <button onClick={handleReanalyzeAll}
                          style={{ padding: "8px 14px", borderRadius: 8, border: "1.5px solid #7c6f5e", background: "white", color: "#7c6f5e", fontFamily: "inherit", fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
                          🔄 Re-analyze All
                        </button>
                      </>) : (
                        <button onClick={() => { bulkCancelRef.current = true; }}
                          style={{ padding: "8px 14px", borderRadius: 8, border: "1.5px solid #dc2626", background: "#fff1f2", color: "#dc2626", fontFamily: "inherit", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                          ✕ Stop Analysis
                        </button>
                      )}
                    </div>

                    {/* Row 2 — Data & Admin */}
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", padding: "10px 14px", background: "#f8fafc", borderRadius: 12, border: "1px solid #e2e8f0" }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: "#475569", textTransform: "uppercase", letterSpacing: "0.6px", marginRight: 4, whiteSpace: "nowrap" }}>🗄️ Data &amp; Admin</span>
                      <button onClick={() => syncToPublic(analyses)} disabled={syncing}
                        style={{ padding: "8px 14px", borderRadius: 8, border: "2px solid #0369a1", background: syncing ? "#eff6ff" : "#0369a1", color: syncing ? "#0369a1" : "white", fontFamily: "inherit", fontSize: 13, fontWeight: 700, cursor: syncing ? "wait" : "pointer", whiteSpace: "nowrap" }}>
                        {syncing ? "⏳ Syncing…" : "☁️ Sync to Public"}
                      </button>
                      <button onClick={handleExportAnalyses}
                        style={{ padding: "8px 14px", borderRadius: 8, border: "1.5px solid #059669", background: "#f0fdf4", color: "#065f46", fontFamily: "inherit", fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
                        ⬇️ Export Analyses
                      </button>
                      <button onClick={handleExportComplianceCSV}
                        style={{ padding: "8px 14px", borderRadius: 8, border: "1.5px solid #0d9488", background: "#f0fdfa", color: "#0f766e", fontFamily: "inherit", fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
                        📊 Export Compliance CSV
                      </button>
                      <button onClick={() => importFileRef.current?.click()}
                        style={{ padding: "8px 14px", borderRadius: 8, border: "1.5px solid #d97706", background: "#fffbeb", color: "#92400e", fontFamily: "inherit", fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
                        ⬆️ Import Analyses
                      </button>
                      <input ref={importFileRef} type="file" accept=".json" onChange={handleImportAnalyses} style={{ display: "none" }} />
                      <button onClick={runStorageDiag} disabled={diagLoading}
                        style={{ padding: "8px 14px", borderRadius: 8, border: "1.5px solid #7c3aed", background: "#f5f3ff", color: "#7c3aed", fontFamily: "inherit", fontSize: 13, fontWeight: 700, cursor: diagLoading ? "wait" : "pointer", whiteSpace: "nowrap" }}>
                        {diagLoading ? "⏳ Checking…" : "🔍 Storage Diagnostic"}
                      </button>
                      <div style={{ flex: 1 }} />
                      <button onClick={() => setAdminMode(false)}
                        style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #d4cfc7", background: "white", color: "#7c6f5e", fontFamily: "inherit", fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" }}>
                        Sign Out
                      </button>
                    </div>

                    {/* Status messages */}
                    {(lastSynced || importMsg) && (
                      <div style={{ marginTop: 6, paddingLeft: 4, display: "flex", gap: 16 }}>
                        {lastSynced && (
                          <span style={{ fontSize: 11, color: "#059669" }}>
                            ✅ {lastSynced.count} analyses synced in {lastSynced.numChunks} chunk{lastSynced.numChunks !== 1 ? "s" : ""} ({lastSynced.sizeMB} MB) · {lastSynced.time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        )}
                        {importMsg && (
                          <span style={{ fontSize: 12, fontWeight: 700, color: importMsg.type === "success" ? "#065f46" : importMsg.type === "error" ? "#7f1d1d" : "#1e40af" }}>
                            {importMsg.text}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Storage Diagnostic panel */}
                    {storageInfo && (
                      <div style={{ marginTop: 10, padding: "14px 18px", background: "#faf5ff", borderRadius: 12, border: "1.5px solid #c4b5fd", fontSize: 12, color: "#4c1d95", lineHeight: 2 }}>
                        <strong style={{ fontSize: 13 }}>🗄️ Storage Diagnostic</strong>
                        <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px 24px" }}>
                          <div>📱 <strong>In memory:</strong> {storageInfo.inMemory} analyses</div>
                          <div>☁️ <strong>Shared chunks:</strong> {storageInfo.sharedChunkEntries} entries ({storageInfo.sharedChunks} chunk{storageInfo.sharedChunks !== 1 ? "s" : ""})</div>
                          <div>📦 <strong>Legacy shared key:</strong> {storageInfo.sharedLegacyEntries} entries ({storageInfo.sharedLegacySizeKB} KB)</div>
                          <div>🔒 <strong>Legacy private key:</strong> {storageInfo.privateLegacyEntries} entries</div>
                        </div>
                        {storageInfo.inMemory === 0 && storageInfo.sharedChunkEntries === 0 && storageInfo.sharedLegacyEntries === 0 && (
                          <div style={{ marginTop: 10, padding: "8px 12px", background: "#fee2e2", borderRadius: 8, color: "#7f1d1d", fontWeight: 700 }}>⚠️ No analyses found anywhere — analyses need to be re-run.</div>
                        )}
                        {storageInfo.inMemory > 0 && storageInfo.sharedChunkEntries < storageInfo.inMemory && (
                          <div style={{ marginTop: 10, padding: "8px 12px", background: "#fef3c7", borderRadius: 8, color: "#92400e", fontWeight: 700 }}>⚠️ Memory has {storageInfo.inMemory} but shared storage only has {storageInfo.sharedChunkEntries}. Click ☁️ Sync to Public to fix.</div>
                        )}
                        {storageInfo.sharedChunkEntries >= storageInfo.inMemory && storageInfo.inMemory > 0 && (
                          <div style={{ marginTop: 10, padding: "8px 12px", background: "#d1fae5", borderRadius: 8, color: "#065f46", fontWeight: 700 }}>✅ Shared storage is up to date.</div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Bulk Analysis Progress Bar */}
                  {bulkAnalyzing && (
                    <div style={{ background: "white", borderRadius: 14, padding: "18px 22px", marginBottom: 20, border: "2px solid #059669", boxShadow: "0 4px 16px rgba(5,150,105,0.12)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                        <span style={{ fontWeight: 800, color: "#065f46", fontSize: 15 }}>🔍 Analyzing Privacy Policies…</span>
                        <span style={{ fontSize: 13, color: "#7c6f5e", fontWeight: 700 }}>{bulkProgress.current} / {bulkProgress.total}</span>
                      </div>
                      <div style={{ background: "#d1fae5", borderRadius: 999, height: 10, overflow: "hidden", marginBottom: 10 }}>
                        <div style={{ height: "100%", borderRadius: 999, background: "linear-gradient(90deg, #059669, #10b981)", width: `${(bulkProgress.current / bulkProgress.total) * 100}%`, transition: "width 0.4s ease" }} />
                      </div>
                      <div style={{ fontSize: 12, color: "#7c6f5e", fontStyle: "italic" }}>
                        Currently analyzing: <strong style={{ color: "#1c3557" }}>{bulkProgress.currentName}</strong>
                      </div>
                    </div>
                  )}

                  {/* Add Resource Form */}
                  {addingRes && (
                    <div className="card" style={{ background: "white", borderRadius: 16, padding: 24, marginBottom: 20, border: "2px solid #3b6fba", boxShadow: "0 4px 20px rgba(59,111,186,0.10)" }}>
                      <h3 style={{ margin: "0 0 16px", color: "#1c3557" }}>New Resource</h3>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
                        {[["name","Resource Name *"],["url","Website URL *"],["category","Category"]].map(([k, label]) => (
                          <label key={k} style={{ display: "block" }}>
                            <span style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#7c6f5e", textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 5 }}>{label}</span>
                            <input value={newRes[k]} onChange={e => setNewRes(r => ({ ...r, [k]: e.target.value }))}
                              style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #d4cfc7", fontFamily: "inherit", fontSize: 14, boxSizing: "border-box" }} />
                          </label>
                        ))}
                        <label style={{ display: "block" }}>
                          <span style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#7c6f5e", textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 5 }}>Label</span>
                          <select value={newRes.label || ""} onChange={e => setNewRes(r => ({ ...r, label: e.target.value }))}
                            style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #d4cfc7", fontFamily: "inherit", fontSize: 14, boxSizing: "border-box", background: "white" }}>
                            <option value="">— None —</option>
                            {LABELS.map(l => <option key={l} value={l}>{l}</option>)}
                          </select>
                        </label>
                      </div>
                      <button className="btn-primary" onClick={handleAddResource} disabled={savingRes}
                        style={{ marginTop: 16, padding: "10px 24px", background: "#1c3557", color: "white", borderRadius: 10, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
                        {savingRes ? <><Spinner size={14} /> Saving…</> : "✓ Add to Library"}
                      </button>
                    </div>
                  )}

                  {/* Resource List */}
                  <div style={{ display: "grid", gap: 10 }}>
                    {[...resources].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })).map((r, i) => (
                      <div key={r.id} className="card" style={{ background: "white", borderRadius: 12, padding: "14px 18px", display: "flex", alignItems: "center", gap: 14, border: "1px solid #e2ddd5", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
                        <span style={{ fontSize: 13, color: "#c4bbb0", fontWeight: 700, minWidth: 24 }}>{i + 1}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                            <span style={{ fontWeight: 700, color: "#1c3557" }}>{r.name}</span>
                            <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: CATEGORY_COLORS[r.category] || CATEGORY_COLORS.Other }}>{r.category}</span>
                            {r.label && (() => { const ls = LABEL_STYLES[r.label] || { bg: "#f3f4f6", text: "#374151", border: "#d1d5db" }; return <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 20, background: ls.bg, color: ls.text, border: `1px solid ${ls.border}` }}>{r.label}</span>; })()}
                            {analyses[r.id]?.done && (
                              <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: "#d1fae5", color: "#065f46" }}>✓ Analyzed</span>
                            )}
                          </div>
                          <div style={{ fontSize: 12, color: "#9c8e81", marginTop: 4, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                            <span>{r.url}</span>
                            {analyses[r.id]?.analyzedAt && (
                              <span style={{ fontStyle: "italic" }}>
                                Last analyzed: {new Date(analyses[r.id].analyzedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                              </span>
                            )}
                            <select value={r.label || ""} onChange={e => persistResources(resources.map(x => x.id === r.id ? { ...x, label: e.target.value } : x))}
                              style={{ padding: "3px 8px", borderRadius: 6, border: "1px solid #d4cfc7", fontFamily: "inherit", fontSize: 11, background: "white", color: "#374151", cursor: "pointer" }}>
                              <option value="">— Set Label —</option>
                              {LABELS.map(l => <option key={l} value={l}>{l}</option>)}
                            </select>
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 8, flexShrink: 0, alignItems: "center" }}>
                          {(() => {
                            const cl = checklists[r.id];
                            const status = cl?.overallStatus || "pending";
                            const TOTAL_ITEMS = 24;
                            const checkedItems = cl ? Object.values(cl.steps || {}).reduce((acc, s) => acc + Object.values(s.items || {}).filter(v => v != null).length, 0) : 0;
                            const statusConfig = {
                              approved: { bg: "#d1fae5", color: "#065f46", label: "✓ Approved" },
                              denied:   { bg: "#fee2e2", color: "#991b1b", label: "✕ Denied"   },
                              pending:  { bg: "#f1f5f9", color: "#64748b", label: checkedItems > 0 ? `⏳ ${checkedItems}/${TOTAL_ITEMS} Items` : "— Not Started" },
                            };
                            const sc = statusConfig[status];
                            return (
                              <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 20, background: sc.bg, color: sc.color, whiteSpace: "nowrap" }}>
                                {sc.label}
                              </span>
                            );
                          })()}
                          <button onClick={() => setChecklistResource(r)}
                            style={{ padding: "6px 12px", border: "1px solid #5eead4", background: "#f0fdfa", color: "#0f766e", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>
                            📋 Checklist
                          </button>
                          {analyzing[r.id] ? (
                            <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#3b6fba", fontWeight: 700, padding: "6px 12px" }}>
                              <Spinner size={12} /> Analyzing…
                            </span>
                          ) : (
                            <button onClick={() => handleAnalyze(r, true)}
                              title={analyses[r.id]?.done ? "Re-analyze this resource" : "Analyze this resource"}
                              style={{ padding: "6px 12px", border: "1px solid #bfdbfe", background: "#eff6ff", color: "#3b6fba", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700 }}>
                              {analyses[r.id]?.done ? "🔄 Re-analyze" : "🔍 Analyze"}
                            </button>
                          )}
                          <button onClick={() => handleRemoveResource(r.id)}
                            style={{ padding: "6px 12px", border: "1px solid #fca5a5", background: "#fff1f2", color: "#dc2626", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700 }}>
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div style={{ marginTop: 20, padding: 16, background: "#f0ece4", borderRadius: 12, fontSize: 13, color: "#7c6f5e", lineHeight: 1.6 }}>
                    <strong>💡 Storage & Re-analysis:</strong> All analyses are saved persistently and shared across sessions. Use <em>🔄 Re-analyze</em> on any individual resource when a company updates their privacy policy or terms of use, or use <em>🔄 Re-analyze All</em> to refresh everything at once.
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ════════════════════════════════════════════════════
              COMPLIANCE VIEW
          ════════════════════════════════════════════════════ */}
          {view === "compliance" && (() => {
            const QUESTIONS = {
              "General": [
                { id: "GENQ1", text: "How are changes to key policies managed?" },
              ],
              "Data Collection": [
                { id: "DCQ1", text: "Do the policies list all data collected?" },
                { id: "DCQ2", text: "Do the policies indicate how data is collected?" },
                { id: "DCQ3", text: "Do the policies state who owns the data?" },
                { id: "DCQ4", text: "Do the policies allow users to delete their data entirely?" },
                { id: "DCQ5", text: "Do the policies state the retention of data?" },
              ],
              "Security": [
                { id: "SECQ1", text: "Do the policies state how data is protected?" },
                { id: "SECQ2", text: "Do the policies state all confidential & sensitive information is encrypted throughout?" },
                { id: "SECQ3", text: "Do the policies state whether or not it enforces strong password creation?" },
                { id: "SECQ4", text: "Do the policies indicate whether or not it leverages 2-step (or other forms of multifactor) authentication?" },
                { id: "SECQ5", text: "Do the policies state the use of cookies?" },
              ],
              "Third Party Data": [
                { id: "SHRQ1", text: "Do the policies state the use of third parties?" },
                { id: "SHRQ2", text: "Do the policies state what information is shared with each third party?" },
                { id: "SHRQ3", text: "Do the policies state whether or not users can opt out of third party data sharing?" },
                { id: "SHRQ4", text: "Do the policies state if the supplier requires third parties to adhere to the terms of the vendor/customer agreement?" },
                { id: "SHRQ5", text: "Do the policies state whether or not the user is notified of a change in third parties?" },
              ],
              "Advertising": [
                { id: "ADVQ1", text: "Do the policies indicate if advertisements are displayed?" },
                { id: "ADVQ2", text: "Do the policies indicate whether or not users are targeted for advertisement?" },
                { id: "ADVQ3", text: "Do the policies indicate whether or not any third parties track or collect information for advertisement?" },
                { id: "ADVQ4", text: "Do the policies indicate whether or not web beacons or other tracking methods are used for ad purposes?" },
                { id: "ADVQ5", text: "Do the policies state whether or not users can opt out of sharing data with advertisers?" },
              ],
            };
            const STATUS = {
              "Meets":     { bg: "#d1fae5", text: "#065f46", label: "Meets" },
              "Partially": { bg: "#fef3c7", text: "#92400e", label: "Partially" },
              "Not Met":   { bg: "#fee2e2", text: "#7f1d1d", label: "Not Met" },
            };
            const sortedForCompliance = [...resources].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
            const analyzed = sortedForCompliance.filter(r => analyses[r.id]?.done);
            const unanalyzed = sortedForCompliance.filter(r => !analyses[r.id]?.done);
            const active = complianceResource || (analyzed.length > 0 ? analyzed[0] : resources[0] || null);
            const a = active ? analyses[active.id] : null;
            const compliance = a?.compliance || {};
            const notes = a?.complianceNotes || {};

            const totalQ = 21;
            const meetCount = Object.values(compliance).filter(v => v === "Meets").length;
            const partCount = Object.values(compliance).filter(v => v === "Partially").length;
            const failCount = Object.values(compliance).filter(v => v === "Not Met").length;

            return (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
                  <div>
                    <h2 style={{ margin: 0, color: "#1c3557", fontSize: 20, fontWeight: 800 }}>📋 Compliance Scorecard</h2>
                    <p style={{ margin: "4px 0 0", color: "#7c6f5e", fontSize: 13 }}>Internal use only — not included in parent PDF</p>
                  </div>
                  <select value={active?.id || ""} onChange={e => setComplianceResource(resources.find(r => r.id === e.target.value) || null)}
                    style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #d4cfc7", fontFamily: "inherit", fontSize: 14, background: "white", minWidth: 280 }}>
                    {resources.length === 0 && <option value="">No resources available</option>}
                    {analyzed.length > 0 && (
                      <optgroup label={`✅ Analyzed (${analyzed.length})`}>
                        {analyzed.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                      </optgroup>
                    )}
                    {unanalyzed.length > 0 && (
                      <optgroup label={`⏳ Not Yet Analyzed (${unanalyzed.length})`}>
                        {unanalyzed.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                      </optgroup>
                    )}
                  </select>
                </div>

                {!active ? (
                  <div style={{ textAlign: "center", padding: "60px 20px", color: "#7c6f5e" }}>
                    <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
                    <p style={{ fontSize: 15 }}>No resources found.</p>
                  </div>
                ) : !a?.done ? (
                  <div style={{ background: "white", borderRadius: 16, padding: 28, border: "1px solid #e2ddd5", textAlign: "center", color: "#7c6f5e" }}>
                    <div style={{ fontSize: 36, marginBottom: 12 }}>⏳</div>
                    <p style={{ fontSize: 15 }}>No analysis yet for <strong>{active.name}</strong>.</p>
                    <p style={{ fontSize: 13 }}>Run a privacy analysis from the Admin panel to generate the compliance scorecard.</p>
                  </div>
                ) : !a?.compliance ? (
                  <div style={{ background: "white", borderRadius: 16, padding: 28, border: "1px solid #e2ddd5", textAlign: "center", color: "#7c6f5e" }}>
                    <p style={{ fontSize: 15 }}>Compliance data not available for <strong>{active.name}</strong>.</p>
                    <p style={{ fontSize: 13 }}>This resource was analyzed before the compliance questionnaire was added. Re-analyze it from the Admin panel to generate scores.</p>
                  </div>
                ) : (
                  <div>
                    {/* Resource Header Card */}
                    <div style={{ background: "white", borderRadius: 16, padding: "20px 24px", marginBottom: 20, border: "1px solid #e2ddd5", boxShadow: "0 2px 10px rgba(0,0,0,0.05)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
                        <div>
                          <div style={{ fontSize: 20, fontWeight: 800, color: "#1c3557", marginBottom: 4 }}>{active.name}</div>
                          <a href={active.url} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: "#3b6fba" }}>{active.url}</a>
                        </div>
                        <div style={{ display: "flex", gap: 12 }}>
                          <div style={{ textAlign: "center", padding: "10px 18px", background: "#d1fae5", borderRadius: 12 }}>
                            <div style={{ fontSize: 22, fontWeight: 800, color: "#065f46" }}>{meetCount}</div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: "#065f46" }}>Meets</div>
                          </div>
                          <div style={{ textAlign: "center", padding: "10px 18px", background: "#fef3c7", borderRadius: 12 }}>
                            <div style={{ fontSize: 22, fontWeight: 800, color: "#92400e" }}>{partCount}</div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: "#92400e" }}>Partially</div>
                          </div>
                          <div style={{ textAlign: "center", padding: "10px 18px", background: "#fee2e2", borderRadius: 12 }}>
                            <div style={{ fontSize: 22, fontWeight: 800, color: "#7f1d1d" }}>{failCount}</div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: "#7f1d1d" }}>Not Met</div>
                          </div>
                          <div style={{ textAlign: "center", padding: "10px 18px", background: "#f0ece4", borderRadius: 12 }}>
                            <div style={{ fontSize: 22, fontWeight: 800, color: "#1c3557" }}>{Math.round((meetCount / totalQ) * 100)}%</div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: "#7c6f5e" }}>Score</div>
                          </div>
                        </div>
                      </div>
                      {/* Progress bar */}
                      <div style={{ marginTop: 16, height: 8, borderRadius: 999, background: "#f0ece4", overflow: "hidden", display: "flex" }}>
                        <div style={{ width: `${(meetCount/totalQ)*100}%`, background: "#10b981", transition: "width 0.4s" }} />
                        <div style={{ width: `${(partCount/totalQ)*100}%`, background: "#f59e0b", transition: "width 0.4s" }} />
                        <div style={{ width: `${(failCount/totalQ)*100}%`, background: "#ef4444", transition: "width 0.4s" }} />
                      </div>
                    </div>

                    {/* Category Sections */}
                    {Object.entries(QUESTIONS).map(([category, qs]) => (
                      <div key={category} style={{ background: "white", borderRadius: 16, padding: "20px 24px", marginBottom: 16, border: "1px solid #e2ddd5", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
                        <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 800, color: "#1c3557", borderBottom: "2px solid #f0ece4", paddingBottom: 10 }}>{category}</h3>
                        <div style={{ display: "grid", gap: 10 }}>
                          {qs.map(q => {
                            const status = compliance[q.id];
                            const s = STATUS[status] || { bg: "#f3f4f6", text: "#6b7280", label: "—" };
                            const note = notes[q.id];
                            return (
                              <div key={q.id} style={{ display: "flex", gap: 14, alignItems: "flex-start", padding: "12px 14px", borderRadius: 10, background: "#faf8f5", border: "1px solid #f0ece4" }}>
                                <div style={{ flexShrink: 0, width: 72 }}>
                                  <div style={{ fontSize: 10, fontWeight: 700, color: "#9c8e81", marginBottom: 4 }}>{q.id}</div>
                                  <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 20, background: s.bg, color: s.text, fontSize: 11, fontWeight: 800 }}>{s.label}</span>
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: 13, fontWeight: 600, color: "#1c3557", marginBottom: note ? 4 : 0 }}>{q.text}</div>
                                  {note && <div style={{ fontSize: 12, color: "#7c6f5e", lineHeight: 1.6, fontStyle: "italic" }}>{note}</div>}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}

          {/* ════════════════════════════════════════════════════
              PDF PREVIEW
          ════════════════════════════════════════════════════ */}
          {view === "pdf" && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                <div>
                  <h2 style={{ margin: 0, color: "#1c3557", fontSize: 20, fontWeight: 800 }}>📄 Syllabus Attachment Preview</h2>
                  <p style={{ margin: "4px 0 0", color: "#7c6f5e", fontSize: 13 }}>Download an <strong>interactive HTML file</strong> — parents open it in any browser, fill in initials, type their name, draw their signature, then click Print / Save as PDF directly from the file. No account needed.</p>
                </div>
                <button className="btn-primary" onClick={() => {
                    const html = buildHTMLDoc(selectedList, analyses, teacherInfo, parentForm);
                    const blob = new Blob([html], { type: "text/html" });
                    const blobUrl = URL.createObjectURL(blob);
                    const safeName = teacherInfo.name ? teacherInfo.name.replace(/[^a-zA-Z0-9]/g, "_") + "_" : "";
                    const a = document.createElement("a");
                    a.href = blobUrl;
                    a.download = `${safeName}EdTech_Privacy_Disclosure.html`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
                    setPdfDownloaded(true);
                  }}
                  style={{ padding: "13px 30px", background: "linear-gradient(135deg, #1c3557, #3b6fba)", color: "white", borderRadius: 12, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 15, fontWeight: 800, boxShadow: "0 4px 18px rgba(28,53,87,0.28)" }}>
                  ⬇️ Download & Print
                </button>
              </div>

              {pdfDownloaded && (
                <div style={{ marginBottom: 20, padding: "14px 20px", background: "#d1fae5", borderRadius: 12, border: "1px solid #6ee7b7", fontSize: 13, color: "#065f46", lineHeight: 1.8 }}>
                  <strong>✅ File downloaded!</strong> Find it in your Downloads folder.<br />
                  <strong>Next:</strong> Open the file in Chrome or Edge → the print dialog will appear automatically → select <strong>Save as PDF</strong> for destination.
                </div>
              )}

              {selectedList.length === 0 ? (
                <div style={{ textAlign: "center", padding: "80px 24px", color: "#9c8e81" }}>
                  <div style={{ fontSize: 64, marginBottom: 16 }}>📋</div>
                  <h3 style={{ margin: "0 0 8px", color: "#7c6f5e" }}>No tools selected</h3>
                  <p style={{ margin: 0 }}>Go to Teacher View, check the resources you use, and come back here to generate your PDF.</p>
                </div>
              ) : (
                /* PDF DOCUMENT */
                <div ref={printRef} id="pdf-doc" style={{ background: "white", borderRadius: 20, padding: "48px 56px", boxShadow: "0 4px 32px rgba(0,0,0,0.10)", border: "1px solid #e2ddd5", maxWidth: 820, margin: "0 auto" }}>
                  {/* Document Header */}
                  <div style={{ borderBottom: "3px solid #1c3557", paddingBottom: 22, marginBottom: 28 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <h1 style={{ margin: "0 0 5px", fontSize: 24, color: "#1c3557", fontWeight: 800, letterSpacing: "-0.5px" }}>
                          Digital Tools & Technology Notice
                        </h1>
                        <p style={{ margin: 0, color: "#7c6f5e", fontSize: 13 }}>
                          Syllabus Attachment — Privacy & Data Disclosure
                        </p>
                      </div>
                      <div style={{ textAlign: "right", fontSize: 12, color: "#9c8e81" }}>
                        <div>{new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</div>
                        <div>Academic Year {teacherInfo.year || "—"}</div>
                      </div>
                    </div>
                  </div>

                  {/* Teacher Info */}
                  {(teacherInfo.name || teacherInfo.subject || teacherInfo.school) && (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px 20px", marginBottom: 24, padding: 16, background: "#f7f5f1", borderRadius: 12, fontSize: 13 }}>
                      {teacherInfo.name && <div><span style={{ fontWeight: 700, color: "#7c6f5e" }}>Teacher: </span>{teacherInfo.name}</div>}
                      {teacherInfo.subject && <div><span style={{ fontWeight: 700, color: "#7c6f5e" }}>Course: </span>{teacherInfo.subject}</div>}
                      {teacherInfo.grade && <div><span style={{ fontWeight: 700, color: "#7c6f5e" }}>Grade: </span>{teacherInfo.grade}</div>}
                      {teacherInfo.school && <div><span style={{ fontWeight: 700, color: "#7c6f5e" }}>School: </span>{teacherInfo.school}</div>}
                      {teacherInfo.principal && <div><span style={{ fontWeight: 700, color: "#7c6f5e" }}>Principal: </span>{teacherInfo.principal}</div>}
                    </div>
                  )}

                  {/* Intro text */}
                  <p style={{ margin: "0 0 28px", color: "#3c3529", fontSize: 14, lineHeight: 1.75 }}>
                    The following digital tools and online platforms are used in this course. In compliance with student
                    data privacy requirements, this document discloses each platform's data collection practices,
                    privacy policy, and terms of service. Please review this information and contact the teacher if
                    you have questions or concerns before your student uses any of these tools.
                  </p>

                  {/* Quick Reference Table */}
                  <div style={{ marginBottom: 32 }}>
                    <h2 style={{ margin: "0 0 12px", fontSize: 16, color: "#1c3557", fontWeight: 800 }}>Quick Reference Summary</h2>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                      <thead>
                        <tr style={{ background: "#1c3557", color: "white" }}>
                          {["Tool", "Category", "Account Required", "Min. Age", "Risk Level", "Terms of Service", "Privacy Policy"].map(h => (
                            <th key={h} style={{ padding: "9px 12px", textAlign: "left", fontWeight: 700, fontSize: 11 }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {selectedList.map((r, i) => {
                          const a = analyses[r.id];
                          const risk = a?.riskLevel;
                          const rs = risk ? RISK[risk] : null;
                          return (
                            <tr key={r.id} style={{ background: i % 2 === 0 ? "#f7f5f1" : "white" }}>
                              <td style={{ padding: "8px 12px", fontWeight: 700, color: "#1c3557" }}>{r.name}</td>
                              <td style={{ padding: "8px 12px" }}>{r.category}</td>
                              <td style={{ padding: "8px 12px" }}>{a ? (a.accountRequired ? "Yes" : "No") : "—"}</td>
                              <td style={{ padding: "8px 12px" }}>{a?.minAge || "—"}</td>
                              <td style={{ padding: "8px 12px" }}>
                                {rs ? (
                                  <span style={{ padding: "2px 8px", borderRadius: 12, background: rs.bg, color: rs.text, fontWeight: 700 }}>{risk}</span>
                                ) : "—"}
                              </td>
                              <td style={{ padding: "8px 12px" }}>
                                {(a?.tosUrl || r.tosUrl) ? <a href={a?.tosUrl || r.tosUrl} style={{ color: "#3b6fba", fontSize: 11 }}>View ToS</a> : "—"}
                              </td>
                              <td style={{ padding: "8px 12px" }}>
                                {(a?.ppUrl || r.ppUrl) ? <a href={a?.ppUrl || r.ppUrl} style={{ color: "#3b6fba", fontSize: 11 }}>View Policy</a> : "—"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Detailed Entries — consent-required only */}
                  {(() => { const consentItems = selectedList.filter(r => !NO_CONSENT_LABELS.has(r.label)); return (
                  <>
                  <h2 style={{ margin: "0 0 8px", fontSize: 16, color: "#1c3557", fontWeight: 800, borderTop: "2px solid #e2ddd5", paddingTop: 20 }}>
                    Detailed Platform Information
                  </h2>
                  <p style={{ margin: "0 0 20px", fontSize: 12, color: "#7c6f5e", lineHeight: 1.7 }}>
                    The following tools require parent/guardian review and initials. District-approved tools are listed in the summary table above and do not require a signature.
                  </p>
                  {consentItems.length === 0 ? (
                    <div style={{ padding: "16px 20px", background: "#d1fae5", borderRadius: 12, border: "2px solid #6ee7b7", fontSize: 13, color: "#065f46", fontWeight: 700, marginBottom: 32 }}>
                      ✓ All selected tools are District Approved — no detailed review or parental signature is required.
                    </div>
                  ) : consentItems.map((resource, idx) => {
                    const a = analyses[resource.id];
                    const risk = a?.riskLevel;
                    const rs = risk ? RISK[risk] : null;
                    return (
                      <div key={resource.id} style={{ marginBottom: 28, paddingBottom: 28, borderBottom: idx < consentItems.length - 1 ? "1px solid #e2ddd5" : "none" }}>
                        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 10 }}>
                          <div style={{ width: 30, height: 30, background: "#1c3557", color: "white", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 14, flexShrink: 0 }}>
                            {idx + 1}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                              <span style={{ fontWeight: 800, fontSize: 16, color: "#1c3557" }}>{resource.name}</span>
                              <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: CATEGORY_COLORS[resource.category] || CATEGORY_COLORS.Other }}>{resource.category}</span>
                              {rs && <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: rs.bg, color: rs.text }}>{risk} Risk</span>}
                            </div>
                            <div style={{ fontSize: 12, color: "#7c6f5e", marginTop: 2 }}>
                              <a href={resource.url} style={{ color: "#3b6fba" }}>{resource.url}</a>
                            </div>
                          </div>
                        </div>

                        <div style={{ paddingLeft: 42, fontSize: 13 }}>
                          {a?.done ? (
                            <>
                              {/* Summary */}
                              <p style={{ margin: "0 0 12px", color: "#3c3529", lineHeight: 1.7 }}>{a.parentSummary}</p>
                              {/* Risk reason */}
                              {a.riskReason && <p style={{ margin: "0 0 12px", color: "#7c6f5e", fontStyle: "italic" }}>Risk note: {a.riskReason}</p>}
                              {/* Data grid */}
                              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
                                {a.accountRequired !== undefined && (
                                  <div style={{ padding: "7px 10px", background: "#f7f5f1", borderRadius: 8 }}>
                                    <strong>Account Required:</strong> {a.accountRequired ? "Yes" : "No"}
                                  </div>
                                )}
                                {a.minAge && (
                                  <div style={{ padding: "7px 10px", background: "#f7f5f1", borderRadius: 8 }}>
                                    <strong>Minimum Age:</strong> {a.minAge}
                                  </div>
                                )}
                                {a.studentDataSold !== undefined && (
                                  <div style={{ padding: "7px 10px", background: "#f7f5f1", borderRadius: 8 }}>
                                    <strong>Student Data Sold:</strong> {a.studentDataSold === "Not specified" ? "Not Specified" : a.studentDataSold ? "Yes ⚠️" : "No"}
                                  </div>
                                )}
                                {(a.coppaCompliant !== undefined || a.ferpaCompliant !== undefined) && (
                                  <div style={{ padding: "7px 10px", background: "#f7f5f1", borderRadius: 8 }}>
                                    <strong>Compliance: </strong>
                                    {a.coppaCompliant === true ? "COPPA ✓ " : ""}
                                    {a.ferpaCompliant === true ? "FERPA ✓" : ""}
                                    {!a.coppaCompliant && !a.ferpaCompliant ? "Not specified" : ""}
                                  </div>
                                )}
                              </div>
                              {/* Data collected */}
                              {a.dataCollected?.length > 0 && (
                                <div style={{ marginBottom: 8 }}>
                                  <strong>Data Collected: </strong>
                                  <span style={{ color: "#5c5044" }}>{a.dataCollected.join(" · ")}</span>
                                </div>
                              )}
                              {/* Shared with */}
                              {a.dataSharedWith?.length > 0 && (
                                <div style={{ marginBottom: 10 }}>
                                  <strong>Shared With: </strong>
                                  <span style={{ color: "#5c5044" }}>{a.dataSharedWith.join(", ")}</span>
                                </div>
                              )}
                              {/* Links — ToS & PP side by side */}
                              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
                                <div style={{ padding: "10px 12px", background: "#f0f4fb", borderRadius: 8, borderLeft: "3px solid #3b6fba" }}>
                                  <div style={{ fontSize: 11, fontWeight: 700, color: "#3b6fba", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>
                                    📜 Terms of Service
                                  </div>
                                  {(a.tosUrl || resource.tosUrl)
                                    ? <a href={a.tosUrl || resource.tosUrl} target="_blank" rel="noreferrer" style={{ color: "#1c3557", fontSize: 11, wordBreak: "break-all", lineHeight: 1.5 }}>{a.tosUrl || resource.tosUrl}</a>
                                    : <span style={{ color: "#9c8e81", fontSize: 11, fontStyle: "italic" }}>Not found</span>}
                                </div>
                                <div style={{ padding: "10px 12px", background: "#f0f4fb", borderRadius: 8, borderLeft: "3px solid #3b6fba" }}>
                                  <div style={{ fontSize: 11, fontWeight: 700, color: "#3b6fba", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>
                                    🔒 Privacy Policy
                                  </div>
                                  {(a.ppUrl || resource.ppUrl)
                                    ? <a href={a.ppUrl || resource.ppUrl} target="_blank" rel="noreferrer" style={{ color: "#1c3557", fontSize: 11, wordBreak: "break-all", lineHeight: 1.5 }}>{a.ppUrl || resource.ppUrl}</a>
                                    : <span style={{ color: "#9c8e81", fontSize: 11, fontStyle: "italic" }}>Not found</span>}
                                </div>
                              </div>
                            </>
                          ) : (
                            <div style={{ padding: 12, background: "#fef9c3", borderRadius: 8, color: "#854d0e", fontSize: 13, marginBottom: 16 }}>
                              ⚠️ Privacy analysis not yet completed for this tool. Return to Teacher View and click "Analyze Privacy & Terms" to generate the full disclosure.
                            </div>
                          )}

                          {/* ── Per-resource parental initials line ── */}
                          {NO_CONSENT_LABELS.has(resource.label) ? (
                            <div style={{ borderTop: "1px dashed #c8c0b4", paddingTop: 10, marginTop: 4 }}>
                              <span style={{ fontSize: 11, fontWeight: 700, color: "#059669", background: "#d1fae5", padding: "3px 10px", borderRadius: 20 }}>
                                ✓ District Approved — No parental signature required
                              </span>
                            </div>
                          ) : (
                          <div style={{ display: "flex", alignItems: "center", gap: 0, marginTop: 4, borderTop: "1px dashed #c8c0b4", paddingTop: 12 }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 11, fontWeight: 700, color: "#7c6f5e", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>
                                Parent / Guardian Initials
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                <input
                                  type="text" maxLength={6}
                                  value={parentForm.initials[resource.id]?.initial || ""}
                                  onChange={e => pfInitial(resource.id, e.target.value)}
                                  placeholder="initials"
                                  style={{ width: 90, padding: "6px 10px", borderRadius: 6, border: parentForm.initials[resource.id]?.initial ? "2px solid #059669" : "2px solid #1c3557", fontFamily: "Georgia, serif", fontSize: 18, color: "#1c3557", textAlign: "center", background: parentForm.initials[resource.id]?.declined ? "#fef2f2" : "white", outline: "none" }}
                                />
                                {parentForm.initials[resource.id]?.initial && !parentForm.initials[resource.id]?.declined && (
                                  <span style={{ fontSize: 11, color: "#059669", fontWeight: 700 }}>✓ Acknowledged</span>
                                )}
                              </div>
                            </div>
                            <div
                              onClick={() => pfDecline(resource.id, !parentForm.initials[resource.id]?.declined)}
                              style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 7, paddingLeft: 24, borderLeft: "1px dashed #c8c0b4", marginLeft: 24, cursor: "pointer", userSelect: "none" }}>
                              <div style={{ width: 18, height: 18, border: "2px solid #1c3557", borderRadius: 3, flexShrink: 0, background: parentForm.initials[resource.id]?.declined ? "#1c3557" : "white", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                {parentForm.initials[resource.id]?.declined && <span style={{ color: "white", fontSize: 13, lineHeight: 1 }}>✓</span>}
                              </div>
                              <span style={{ fontSize: 11, color: parentForm.initials[resource.id]?.declined ? "#7f1d1d" : "#7c6f5e", fontWeight: 600, lineHeight: 1.4 }}>
                                I decline consent<br />for this tool
                              </span>
                            </div>
                          </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  </> ); })()}

                  {/* Footer notice */}
                  <div style={{ marginTop: 32, padding: 16, background: "#f7f5f1", borderRadius: 12, fontSize: 12, color: "#7c6f5e", lineHeight: 1.7, borderLeft: "4px solid #1c3557" }}>
                    <strong>Notice to Parents & Guardians:</strong> If you do not wish for your child to use any of the platforms listed above,
                    please notify the teacher in writing within the first week of school. Alternative assignments may be made available upon request.
                    Risk levels and privacy summaries are generated using AI analysis and should be used for informational purposes.
                    Always review official policy pages for the most current information.
                  </div>

                  {/* ── Parental Approval Section ── */}
                  {selectedList.some(r => !NO_CONSENT_LABELS.has(r.label)) ? (
                  <div style={{ marginTop: 32, border: "2px solid #1c3557", borderRadius: 14, overflow: "hidden" }}>
                    {/* Section header */}
                    <div style={{ background: "#1c3557", padding: "12px 20px" }}>
                      <h3 style={{ margin: 0, color: "white", fontSize: 14, fontWeight: 800, letterSpacing: "0.5px", textTransform: "uppercase" }}>
                        ✍️ Parental / Guardian Acknowledgment
                      </h3>
                    </div>
                    <div style={{ padding: "20px 24px" }}>
                      <p style={{ margin: "0 0 20px", fontSize: 13, color: "#3c3529", lineHeight: 1.75 }}>
                        By initialing each tool above and signing below, I confirm that I have read and understand
                        the digital tools and data privacy disclosures in this document.
                      </p>

                      {/* Name + Date fields */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px 32px", marginBottom: 20 }}>
                        {[
                          { label: "Parent / Guardian Printed Name", field: "parentName", placeholder: "Full name" },
                          { label: "Student Name", field: "studentName", placeholder: "Student's full name" },
                        ].map(({ label, field, placeholder }) => (
                          <div key={field}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: "#7c6f5e", textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 6 }}>{label}</div>
                            <input type="text" value={parentForm[field]} onChange={e => pf(field, e.target.value)} placeholder={placeholder}
                              style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "2px solid #1c3557", fontFamily: "inherit", fontSize: 14, color: "#1c3557", boxSizing: "border-box", outline: "none" }} />
                          </div>
                        ))}
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: "#7c6f5e", textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 6 }}>Date</div>
                          <input type="date" value={parentForm.date} onChange={e => pf("date", e.target.value)}
                            style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "2px solid #1c3557", fontFamily: "inherit", fontSize: 14, color: "#1c3557", boxSizing: "border-box", outline: "none" }} />
                        </div>
                      </div>

                      {/* Drawn signature */}
                      <div style={{ marginBottom: 20 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: "#7c6f5e", textTransform: "uppercase", letterSpacing: "0.6px" }}>
                            Signature <span style={{ color: "#9c8e81", fontStyle: "italic", textTransform: "none", fontWeight: 400, fontSize: 10 }}>(draw with mouse or finger)</span>
                          </div>
                          <button onClick={clearSig} style={{ padding: "4px 12px", borderRadius: 6, border: "1px solid #d4cfc7", background: "white", color: "#7c6f5e", fontFamily: "inherit", fontSize: 12, cursor: "pointer" }}>
                            Clear
                          </button>
                        </div>
                        <canvas ref={sigCanvasRef} width={700} height={120}
                          onMouseDown={sigStart} onMouseMove={sigMove} onMouseUp={sigEnd} onMouseLeave={sigEnd}
                          onTouchStart={sigStart} onTouchMove={sigMove} onTouchEnd={sigEnd}
                          style={{ width: "100%", height: 120, border: "2px solid #1c3557", borderRadius: 8, cursor: "crosshair", background: "white", touchAction: "none", display: "block" }} />
                        {parentForm.signatureDataUrl && <div style={{ fontSize: 11, color: "#059669", fontWeight: 700, marginTop: 4 }}>✓ Signature captured</div>}
                      </div>

                      {/* Opt-out */}
                      <div
                        onClick={() => pf("optOut", !parentForm.optOut)}
                        style={{ marginBottom: 16, padding: "14px 16px", background: parentForm.optOut ? "#fef2f2" : "#f7f5f1", borderRadius: 10, fontSize: 12, color: "#3c3529", lineHeight: 1.7, cursor: "pointer", border: parentForm.optOut ? "1px solid #fca5a5" : "1px solid transparent" }}>
                        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                          <div style={{ width: 18, height: 18, border: "2px solid #1c3557", borderRadius: 3, flexShrink: 0, marginTop: 2, background: parentForm.optOut ? "#1c3557" : "white", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            {parentForm.optOut && <span style={{ color: "white", fontSize: 13, lineHeight: 1 }}>✓</span>}
                          </div>
                          <span>
                            <strong>Opt-Out (click to check if applicable):</strong> I do not consent to my child using one or more of the platforms listed.
                            I have attached a written note identifying which tools I am declining and have discussed alternatives with the teacher.
                          </span>
                        </div>
                      </div>

                      {/* Completion check */}
                      {(parentForm.parentName && parentForm.studentName && parentForm.date && parentForm.signatureDataUrl) ? (
                        <div style={{ padding: "12px 16px", background: "#d1fae5", borderRadius: 10, fontSize: 13, color: "#065f46", fontWeight: 700, marginBottom: 14, textAlign: "center" }}>
                          ✅ Form complete — download and print, or take a screenshot to submit electronically.
                        </div>
                      ) : (
                        <div style={{ padding: "10px 16px", background: "#fffbeb", borderRadius: 10, fontSize: 12, color: "#92400e", marginBottom: 14 }}>
                          📝 Please fill in all fields and sign above to complete the form.
                        </div>
                      )}

                      <div style={{ marginTop: 8, fontSize: 12, color: "#7c6f5e", textAlign: "center", fontStyle: "italic" }}>
                        Please email the signed PDF to your teacher.
                      </div>
                    </div>
                  </div>
                  ) : (
                  <div style={{ marginTop: 32, padding: "16px 20px", background: "#d1fae5", borderRadius: 14, border: "2px solid #6ee7b7", fontSize: 13, color: "#065f46", fontWeight: 700 }}>
                    ✓ All tools on this disclosure are District Approved — no parental signature is required.
                  </div>
                  )}

                  <div style={{ marginTop: 24, display: "flex", justifyContent: "space-between", fontSize: 11, color: "#b0a598", borderTop: "1px solid #e2ddd5", paddingTop: 14 }}>
                    <span>Generated by County EdTech Privacy Disclosure Tool</span>
                    <span>{new Date().toLocaleDateString()}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* ── CLASSROOM VS. EXTRACURRICULAR MODAL ─────────────────────────────── */}
      {/* ── ADMIN: Interactive Approval Checklist Modal ── */}
      {checklistResource && (() => {
        const r = checklistResource;
        const cl = checklists[r.id] || { steps: {}, overallStatus: "pending", finalNote: "", lastUpdated: "" };
        const isLocked = cl.overallStatus === "approved" || cl.overallStatus === "denied";
        const STEPS = [{"num": "1", "icon": "\ud83d\udc69\u200d\ud83c\udfeb", "title": "Before Using Any New Digital Resource", "role": "Teacher Quick Check", "items": [{"text": "Did you search the TrustED Apps Dashboard for this tool?", "type": "yn", "good": "yes"}, {"text": "Is the tool listed as Approved in TrustED Apps?", "type": "yn", "good": "yes"}, {"text": "Is the tool listed as Denied in TrustED Apps?", "type": "yn", "good": "no"}, {"text": "Is the tool NOT listed in TrustED Apps? (Proceed to Step 2)", "type": "yn", "good": "yes"}]}, {"num": "2", "icon": "\ud83d\udcdd", "title": "If the Tool Is NOT Listed", "role": "Teacher Action", "items": [{"text": "Did the teacher submit an IIQ (Instructional Inventory Questionnaire) Digital Resource Review Ticket to initiate the district review process?", "type": "yn", "good": "yes"}]}, {"num": "3", "icon": "\ud83c\udfdb\ufe0f", "title": "District / Admin Review Stage", "role": "Admin or Instructional Tech Team Checks", "items": [{"text": "Is the tool listed in the 1EdTech Catalog?", "type": "yn", "good": null}, {"text": "Did you update TrustED Apps and notify the teacher? (If yes in 1EdTech Catalog)", "type": "yn", "good": "yes"}, {"text": "Did you submit the tool to the 1EdTech Privacy Team for vetting? (If not in 1EdTech Catalog)", "type": "yn", "good": "yes"}]}, {"num": "4", "icon": "\ud83d\udd12", "title": "Privacy & Compliance Evaluation", "role": "District Technology / Compliance Team Reviews", "items": [{"text": "Does the tool collect student data? (FERPA requirement)", "type": "yn", "good": "no"}, {"text": "Does the vendor provide data privacy policies? (FERPA requirement)", "type": "yn", "good": "yes"}, {"text": "Is parental consent needed for students under 13? (COPPA requirement)", "type": "yn", "good": "no"}, {"text": "If the resource involves online content or browsing, does it comply with CIPA filtering expectations?", "type": "yn", "good": "yes"}, {"text": "Does the tool use or share data for advertising? (Schools cannot consent on behalf of parents for commercial data use)", "type": "yn", "good": "no"}, {"text": "General", "type": "section"}, {"text": "GENQ1 \u2014 How are changes to key policies managed?", "type": "mpu", "hint": "Ideal: Policies may be changed any time at their discretion, without notice to the user"}, {"text": "Data Collection", "type": "section"}, {"text": "DCQ1 \u2014 Do the policies list all data collected?", "type": "mpu", "hint": "Ideal: Policies give a broad statement of data collected OR policies are not clear on data collected crucial to app functionality"}, {"text": "DCQ2 \u2014 Do the policies indicate how data is collected?", "type": "mpu", "hint": "Ideal: Policies give a broad statement of how data is collected OR policies are not clear on how data is collected"}, {"text": "DCQ3 \u2014 Do the policies state who owns the data?", "type": "mpu", "hint": "Ideal: Policies do not state who owns the data OR policies state supplier owns all data"}, {"text": "DCQ4 \u2014 Do the policies allow users to delete their data entirely?", "type": "mpu", "hint": "Ideal: Policies allow users to delete data entirely after a period of time OR policies state no data collected"}, {"text": "DCQ5 \u2014 Do the policies state the retention of data?", "type": "mpu", "hint": "Ideal: Policies do not state its data retention policy OR policies state that data is retained for as long as supplier needs it"}, {"text": "Security", "type": "section"}, {"text": "SECQ1 \u2014 Do the policies state how data is protected?", "type": "mpu", "hint": "Ideal: Policies give a broad statement on steps taken to protect data OR policies are unclear on how data is protected"}, {"text": "SECQ2 \u2014 Do the policies state all confidential & sensitive information is encrypted throughout?", "type": "mpu", "hint": "Ideal: Data encrypted throughout OR passes an encryption test with no vulnerabilities OR policies state no data collected"}, {"text": "SECQ3 \u2014 Do the policies state whether or not it enforces strong password creation?", "type": "mpu", "hint": "Ideal: Supplier enforces strong password creation OR supplier user base exempt from password requirements OR no account creation required"}, {"text": "SECQ4 \u2014 Do the policies indicate whether or not it leverages 2-step (or other forms of multifactor) authentication?", "type": "mpu", "hint": "Ideal: Supplier uses SSO or an LTI launch OR no account creation is required OR supplier user base exempt from 2-step authentication requirements"}, {"text": "SECQ5 \u2014 Do the policies state the use of cookies?", "type": "mpu", "hint": "Ideal: Policies give a broad statement on the use of cookies OR policies are unclear if cookies are crucial for app functionality"}, {"text": "Third Party Data", "type": "section"}, {"text": "SHRQ1 \u2014 Do the policies state the use of third parties?", "type": "mpu", "hint": "Ideal: Policies list each third party separately OR policies state third party use strictly for app functionality OR policies state that they do not use third parties"}, {"text": "SHRQ2 \u2014 Do the policies state what information is shared with each third party?", "type": "mpu", "hint": "Ideal: Policies list the data it shares with each third party separately OR policies state that it does not share any data with any third party"}, {"text": "SHRQ3 \u2014 Do the policies state whether or not users can opt out of third party data sharing?", "type": "mpu", "hint": "Ideal: Policies include an easy opt out process for users OR policies state that it does not share any data with any third party"}, {"text": "SHRQ4 \u2014 Do the policies state if the supplier requires third parties to adhere to the terms of the vendor/customer agreement?", "type": "mpu", "hint": "Ideal: Supplier claims responsibility for third party privacy practices OR policies state that it does not share any data with any third party"}, {"text": "SHRQ5 \u2014 Do the policies state whether or not user is notified of a change in third parties?", "type": "mpu", "hint": "Ideal: Supplier changes third party and keeps the same data sharing terms OR supplier does not use any third parties"}, {"text": "Advertising", "type": "section"}, {"text": "ADVQ1 \u2014 Do the policies indicate if advertisements are displayed?", "type": "mpu", "hint": "Ideal: No ads are displayed"}, {"text": "ADVQ2 \u2014 Do the policies indicate whether or not users are targeted for advertisement?", "type": "mpu", "hint": "Ideal: Policies guarantee no ad targeting OR policies state no ads are used on its platform"}, {"text": "ADVQ3 \u2014 Do the policies indicate whether or not any third parties track or collect information for advertisement?", "type": "mpu", "hint": "Ideal: Policies state that third parties might track or collect user data but gives you the option to opt out OR users can opt out of ad networks"}, {"text": "ADVQ4 \u2014 Do the policies indicate whether or not web beacons or other tracking methods are used for ad purposes?", "type": "mpu", "hint": "Ideal: Policies state that it only tracks interactions within its application OR policies state that it does not use any tracking technologies for ads"}, {"text": "ADVQ5 \u2014 Do the policies state whether or not users can opt out of sharing data with advertisers?", "type": "mpu", "hint": "Ideal: Policies state in detail how users can opt out of sharing data with advertisers OR policies state no ads are used on its platform"}]}, {"num": "5", "icon": "\ud83c\udfaf", "title": "Droplet Review Process \u2014 Use Case & Instructional Value", "role": "Admin or Department Leader Confirms", "items": [{"text": "Does the tool have a clear instructional purpose?", "type": "yn", "good": "yes"}, {"text": "Is it non-redundant (no other approved tool provides the same function)?", "type": "yn", "good": "yes"}, {"text": "Is the tool high-quality and aligned with standards?", "type": "yn", "good": "yes"}]}, {"num": "6", "icon": "\ud83d\udccb", "title": "Vendor Requirements", "role": "District or Department Staff", "items": [{"text": "Did you submit the vendor request?", "type": "yn", "good": "yes"}, {"text": "Did the vendor complete required forms (privacy/security questionnaire, DPA if required)?", "type": "yn", "good": "yes"}, {"text": "Did the Technology Department validate FERPA alignment and overall compliance?", "type": "yn", "good": "yes"}, {"text": "Did the Technology Department verify CIPA-related content safety if applicable?", "type": "yn", "good": "yes"}]}, {"num": "7", "icon": "\u2705", "title": "Final Decision", "role": "District Leadership Sign-Off", "items": [{"text": "Did the Department Leader authorize the tool?", "type": "yn", "good": "yes"}, {"text": "Did the Technology Department validate compliance?", "type": "yn", "good": "yes"}, {"text": "Has the TrustED Apps Dashboard been updated (Approved or Denied)?", "type": "yn", "good": "yes"}, {"text": "Has the teacher received notification of the approval status?", "type": "yn", "good": "yes"}]}, {"num": "8", "icon": "\ud83c\udf93", "title": "After Approval", "role": "Teacher Responsibilities", "items": [{"text": "Is the resource being used according to approved guidelines?", "type": "yn", "good": "yes"}, {"text": "Have settings or permissions been kept as approved (no unauthorized changes)?", "type": "yn", "good": "yes"}, {"text": "Have you notified admin if the tool starts collecting new types of data?", "type": "yn", "good": "yes"}, {"text": "Are digital citizenship requirements being followed if applicable (CIPA digital literacy expectation)?", "type": "yn", "good": "yes"}, {"text": "Has parent communication been provided if required by district policy (FERPA expectation for transparency)?", "type": "yn", "good": "yes"}]}, {"num": "9", "icon": "\ud83d\udeab", "title": "If Denied", "role": "Teacher Guidance", "items": [{"text": "Did you refrain from using the tool?", "type": "yn", "good": "yes"}, {"text": "Did you review recommended alternate approved resources?", "type": "yn", "good": "yes"}, {"text": "Did you consult with the Instructional Tech Team for alternatives?", "type": "yn", "good": "yes"}]}];
        const countableItems = (step) => step.items.filter(i => i.type !== "section");

        // Compute which item indices are auto-N/A'd based on trigger answers (within-step logic only)
        const computeAutoNA = (stepNum, stepData) => {
          const it = stepData?.items || {};
          const na = new Set();
          if (stepNum === "1") {
            if (it[1] === "yes") { na.add(2); na.add(3); }      // Approved → N/A Denied & Not Listed
            if (it[2] === "yes") { na.add(3); }                  // Denied   → N/A Not Listed
          }
          if (stepNum === "3") {
            if (it[0] === "yes") { na.add(2); }                  // In catalog → N/A "submit for vetting"
            if (it[0] === "no")  { na.add(1); }                  // Not in catalog → N/A "update TrustED"
          }
          if (stepNum === "4") {
            if (it[0] === "no") { na.add(2); }                   // No student data → N/A parental consent
            if (it[4] === "no") { na.add(26); na.add(27); na.add(28); na.add(29); na.add(30); } // No ads → N/A ADVQ1-5
          }
          return na;
        };

        // Count answered + auto-NA as "answered" for progress
        const answeredItems = STEPS.reduce((acc, s) => {
          const sd = cl.steps?.[s.num];
          const autoNA = computeAutoNA(s.num, sd);
          return acc + countableItems(s).filter(item => {
            const idx = s.items.indexOf(item);
            return sd?.items?.[idx] != null || autoNA.has(idx);
          }).length;
        }, 0);
        const totalItems2 = STEPS.reduce((acc, s) => acc + countableItems(s).length, 0);
        const completedSteps = STEPS.filter(s => {
          const sd = cl.steps?.[s.num];
          const autoNA = computeAutoNA(s.num, sd);
          return countableItems(s).every(item => {
            const idx = s.items.indexOf(item);
            return sd?.items?.[idx] != null || autoNA.has(idx);
          });
        }).length;
        const statusOpts = [
          { value: "pending",  label: "⏳ In Review",  bg: "#fef9c3", color: "#854d0e" },
          { value: "approved", label: "✓ Approved",    bg: "#d1fae5", color: "#065f46" },
          { value: "denied",   label: "✕ Denied",      bg: "#fee2e2", color: "#991b1b" },
        ];
        return (
          <div onClick={() => setChecklistResource(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 9100, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "32px 16px", overflowY: "auto" }}>
            <div onClick={e => e.stopPropagation()} style={{ background: "white", borderRadius: 20, maxWidth: 820, width: "100%", boxShadow: "0 24px 80px rgba(0,0,0,0.25)", overflow: "hidden" }}>
              <div style={{ background: "linear-gradient(135deg, #0f766e 0%, #0d9488 100%)", padding: "24px 32px", display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#99f6e4", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Admin · Digital Resource Approval Checklist</div>
                  <h2 style={{ margin: 0, color: "white", fontSize: 20, fontWeight: 800 }}>📋 {r.name}</h2>
                  <div style={{ marginTop: 6, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                    <span style={{ fontSize: 12, color: "#ccfbf1" }}>{completedSteps} of 9 steps complete · {answeredItems}/{totalItems2} items answered</span>
                    {cl.lastUpdated && <span style={{ fontSize: 11, color: "#99f6e4" }}>· Updated {new Date(cl.lastUpdated).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>}
                  </div>
                  <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8 }}>
                    <label style={{ fontSize: 12, fontWeight: 700, color: "#99f6e4", whiteSpace: "nowrap" }}>👤 Reviewer:</label>
                    <input
                      type="text"
                      value={cl.reviewerName || ""}
                      onChange={e => !isLocked && updateChecklistMeta(r.id, "reviewerName", e.target.value)}
                      placeholder="Enter your name…"
                      maxLength={60}
                      readOnly={isLocked}
                      style={{ padding: "5px 10px", borderRadius: 8, border: "1.5px solid rgba(255,255,255,0.3)", background: isLocked ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.15)", color: isLocked ? "rgba(255,255,255,0.5)" : "white", fontFamily: "inherit", fontSize: 13, fontWeight: 600, outline: "none", width: 220, cursor: isLocked ? "not-allowed" : "text" }}
                    />
                    <span style={{ fontSize: 11, color: "#99f6e4", opacity: 0.8 }}>— recorded with each answer</span>
                  </div>
                </div>
                <button onClick={() => setChecklistResource(null)} style={{ background: "rgba(255,255,255,0.15)", border: "none", color: "white", fontSize: 20, width: 36, height: 36, borderRadius: "50%", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>✕</button>
              </div>
              <div style={{ background: "#ccfbf1", height: 6 }}>
                <div style={{ height: "100%", background: "#0d9488", width: `${(answeredItems / totalItems2) * 100}%`, transition: "width 0.3s ease" }} />
              </div>

              <div style={{ padding: "24px 32px", maxHeight: "68vh", overflowY: "auto" }}>

                {/* Lock Banner */}
                {isLocked && (
                  <div style={{ marginBottom: 16, padding: "12px 18px", borderRadius: 12, background: cl.overallStatus === "approved" ? "#d1fae5" : "#fee2e2", border: `1.5px solid ${cl.overallStatus === "approved" ? "#6ee7b7" : "#fca5a5"}`, display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 20 }}>{cl.overallStatus === "approved" ? "✅" : "🔒"}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 800, fontSize: 13, color: cl.overallStatus === "approved" ? "#065f46" : "#991b1b" }}>
                        Checklist Locked — {cl.overallStatus === "approved" ? "Approved" : "Denied"}
                      </div>
                      <div style={{ fontSize: 12, color: cl.overallStatus === "approved" ? "#047857" : "#b91c1c", marginTop: 2 }}>
                        This checklist is read-only. To make changes, unlock it using the button in the Final Decision section below.
                      </div>
                    </div>
                  </div>
                )}

                {STEPS.map((step) => {
                  const stepData = cl.steps?.[step.num] || { items: {}, note: "" };
                  const countable = step.items.filter(i => i.type !== "section");
                  const autoNA = computeAutoNA(step.num, stepData);
                  const answered = countable.filter(item => {
                    const ri = step.items.indexOf(item);
                    return stepData.items?.[ri] != null || autoNA.has(ri);
                  }).length;
                  const stepDone = answered === countable.length;
                  return (
                    <div key={step.num} style={{ marginBottom: 16, borderRadius: 12, border: `1px solid ${stepDone ? "#6ee7b7" : "#e2ddd5"}`, overflow: "hidden" }}>
                      <div style={{ padding: "12px 16px", background: stepDone ? "#f0fdfa" : "#f7f5f1", display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 28, height: 28, borderRadius: "50%", background: stepDone ? "#0d9488" : "#e2ddd5", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          {stepDone ? <span style={{ color: "white", fontSize: 13 }}>✓</span> : <span style={{ fontWeight: 800, fontSize: 12, color: "#7c6f5e" }}>{step.num}</span>}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 800, fontSize: 13, color: stepDone ? "#0f766e" : "#1c3557" }}>{step.icon} Step {step.num}: {step.title}</div>
                          <div style={{ fontSize: 11, color: "#7c6f5e", marginTop: 1 }}>{step.role} · {answered}/{countable.length} answered</div>
                        </div>
                      </div>
                      <div style={{ padding: "10px 16px 14px", background: "white" }}>
                        {step.items.map((item, idx) => {
                          const val = stepData.items?.[idx];
                          if (item.type === "section") {
                            return (
                              <div key={idx} style={{ margin: "14px 0 8px", paddingBottom: 4, borderBottom: "2px solid #e2ddd5" }}>
                                <span style={{ fontSize: 11, fontWeight: 800, color: "#1c3557", textTransform: "uppercase", letterSpacing: "0.8px" }}>{item.text}</span>
                              </div>
                            );
                          }
                          if (item.type === "mpu") {
                            const isAutoNA = autoNA.has(idx);
                            const MPU = { met: { bg: "#d1fae5", color: "#065f46", border: "#6ee7b7", label: "Met" }, partially: { bg: "#fef3c7", color: "#92400e", border: "#fcd34d", label: "Partially" }, unmet: { bg: "#fee2e2", color: "#991b1b", border: "#fca5a5", label: "Unmet" }, na: { bg: "#e2e8f0", color: "#475569", border: "#94a3b8", label: "N/A" } };
                            const active = isAutoNA ? MPU.na : MPU[val];
                            const answerVal = stepData.answers?.[idx] || "";
                            const meta = stepData.meta?.[idx];
                            return (
                              <div key={idx} style={{ marginBottom: 10, borderRadius: 8, background: isAutoNA ? "#f1f5f9" : active ? active.bg : "#fafaf9", border: `1px solid ${isAutoNA ? "#cbd5e1" : active ? active.border : "#e2ddd5"}`, opacity: isAutoNA ? 0.65 : 1, transition: "all 0.15s", overflow: "hidden" }}>
                                <div style={{ padding: "8px 12px" }}>
                                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: isAutoNA ? 0 : 6 }}>
                                    <div style={{ fontSize: 13, color: isAutoNA ? "#94a3b8" : active ? active.color : "#3c3529", lineHeight: 1.5, flex: 1 }}>{item.text}</div>
                                    {isAutoNA && <span style={{ fontSize: 11, fontWeight: 800, padding: "2px 8px", borderRadius: 6, background: "#e2e8f0", color: "#64748b", whiteSpace: "nowrap", border: "1px solid #cbd5e1", flexShrink: 0 }}>↩ Auto N/A</span>}
                                  </div>
                                  {!isAutoNA && (<>
                                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                                      {Object.entries(MPU).map(([k, s]) => (
                                        <button key={k}
                                          onClick={() => !isLocked && updateChecklistStep(r.id, step.num, `items.${idx}`, val === k ? null : k, cl.reviewerName)}
                                          disabled={isLocked}
                                          style={{ padding: "3px 12px", borderRadius: 6, border: `2px solid ${val === k ? s.color : "#d4cfc7"}`, background: val === k ? s.bg : "white", color: val === k ? s.color : "#7c6f5e", fontFamily: "inherit", fontSize: 12, fontWeight: 800, cursor: isLocked ? "not-allowed" : "pointer", opacity: isLocked && val !== k ? 0.4 : 1 }}>
                                          {s.label}
                                        </button>
                                      ))}
                                    </div>
                                    <div>
                                      <div style={{ fontSize: 10, fontWeight: 700, color: "#9c8e81", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 3 }}>Answer / Notes</div>
                                      <textarea value={answerVal} maxLength={600} placeholder="Enter the policy answer or evaluation notes…"
                                        readOnly={isLocked}
                                        onChange={e => !isLocked && updateChecklistStep(r.id, step.num, `answers.${idx}`, e.target.value)}
                                        style={{ width: "100%", minHeight: 52, padding: "5px 8px", borderRadius: 6, border: "1px solid #d4cfc7", fontFamily: "inherit", fontSize: 12, color: "#1c3557", boxSizing: "border-box", resize: isLocked ? "none" : "vertical", outline: "none", background: isLocked ? "#f8fafc" : "rgba(255,255,255,0.7)", lineHeight: 1.5, cursor: isLocked ? "default" : "text" }} />
                                    </div>
                                  </>)}
                                </div>
                                {meta && !isAutoNA && (
                                  <div style={{ padding: "4px 12px 6px", borderTop: "1px solid rgba(0,0,0,0.05)", display: "flex", gap: 6, alignItems: "center" }}>
                                    <span style={{ fontSize: 10, color: "#9c8e81" }}>✏️</span>
                                    <span style={{ fontSize: 10, color: "#9c8e81", fontWeight: 700 }}>{meta.by || "Unknown"}</span>
                                    <span style={{ fontSize: 10, color: "#b8b0a6" }}>·</span>
                                    <span style={{ fontSize: 10, color: "#b8b0a6" }}>{new Date(meta.at).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                                  </div>
                                )}
                              </div>
                            );
                          }
                          if (item.type === "yn") {
                            const isAutoNA = autoNA.has(idx);
                            const effectiveVal = isAutoNA ? "na" : val;
                            const isGood = effectiveVal != null && effectiveVal !== "na" && effectiveVal === item.good;
                            const isBad  = effectiveVal != null && effectiveVal !== "na" && item.good != null && effectiveVal !== item.good;
                            const isNA   = effectiveVal === "na";
                            const meta   = stepData.meta?.[idx];
                            return (
                              <div key={idx} style={{ marginBottom: 8, borderRadius: 8,
                                background: isAutoNA ? "#f1f5f9" : isNA ? "#f8fafc" : isGood ? "#f0fdfa" : isBad ? "#fff1f2" : "#fafaf9",
                                border: `1px solid ${isAutoNA ? "#cbd5e1" : isNA ? "#94a3b8" : isGood ? "#6ee7b7" : isBad ? "#fca5a5" : "#e2ddd5"}`,
                                opacity: isAutoNA ? 0.7 : 1, transition: "all 0.15s", overflow: "hidden" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px" }}>
                                  <span style={{ fontSize: 13, color: isAutoNA ? "#94a3b8" : isNA ? "#64748b" : isGood ? "#0f766e" : isBad ? "#991b1b" : "#3c3529", lineHeight: 1.5, flex: 1 }}>{item.text}</span>
                                  {isAutoNA ? (
                                    <span style={{ fontSize: 11, fontWeight: 800, padding: "3px 10px", borderRadius: 6, background: "#e2e8f0", color: "#64748b", whiteSpace: "nowrap", border: "1px solid #cbd5e1" }}>↩ Auto N/A</span>
                                  ) : isLocked ? (
                                    <span style={{ fontSize: 12, fontWeight: 800, padding: "4px 12px", borderRadius: 6,
                                      background: val === "yes" ? (item.good === "yes" ? "#059669" : item.good === null ? "#3b6fba" : "#dc2626") : val === "no" ? (item.good === "no" ? "#059669" : item.good === null ? "#3b6fba" : "#dc2626") : val === "na" ? "#64748b" : "#e2e8f0",
                                      color: val != null ? "white" : "#94a3b8",
                                      border: "none" }}>
                                      {val === "yes" ? "Yes" : val === "no" ? "No" : val === "na" ? "N/A" : "—"}
                                    </span>
                                  ) : (
                                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                                      <button onClick={() => updateChecklistStep(r.id, step.num, `items.${idx}`, val === "yes" ? null : "yes", cl.reviewerName)}
                                        style={{ padding: "4px 12px", borderRadius: 6, border: `2px solid ${val === "yes" ? (item.good === "yes" ? "#059669" : item.good === null ? "#3b6fba" : "#dc2626") : "#d4cfc7"}`, background: val === "yes" ? (item.good === "yes" ? "#059669" : item.good === null ? "#3b6fba" : "#dc2626") : "white", color: val === "yes" ? "white" : "#7c6f5e", fontFamily: "inherit", fontSize: 12, fontWeight: 800, cursor: "pointer" }}>
                                        Yes
                                      </button>
                                      <button onClick={() => updateChecklistStep(r.id, step.num, `items.${idx}`, val === "no" ? null : "no", cl.reviewerName)}
                                        style={{ padding: "4px 12px", borderRadius: 6, border: `2px solid ${val === "no" ? (item.good === "no" ? "#059669" : item.good === null ? "#3b6fba" : "#dc2626") : "#d4cfc7"}`, background: val === "no" ? (item.good === "no" ? "#059669" : item.good === null ? "#3b6fba" : "#dc2626") : "white", color: val === "no" ? "white" : "#7c6f5e", fontFamily: "inherit", fontSize: 12, fontWeight: 800, cursor: "pointer" }}>
                                        No
                                      </button>
                                      <button onClick={() => updateChecklistStep(r.id, step.num, `items.${idx}`, val === "na" ? null : "na", cl.reviewerName)}
                                        style={{ padding: "4px 12px", borderRadius: 6, border: `2px solid ${val === "na" ? "#64748b" : "#d4cfc7"}`, background: val === "na" ? "#64748b" : "white", color: val === "na" ? "white" : "#7c6f5e", fontFamily: "inherit", fontSize: 12, fontWeight: 800, cursor: "pointer" }}>
                                        N/A
                                      </button>
                                    </div>
                                  )}
                                </div>
                                {meta && !isAutoNA && (
                                  <div style={{ padding: "4px 12px 6px", borderTop: "1px solid rgba(0,0,0,0.05)", display: "flex", gap: 6, alignItems: "center" }}>
                                    <span style={{ fontSize: 10, color: "#9c8e81" }}>✏️</span>
                                    <span style={{ fontSize: 10, color: "#9c8e81", fontWeight: 700 }}>{meta.by || "Unknown"}</span>
                                    <span style={{ fontSize: 10, color: "#b8b0a6" }}>·</span>
                                    <span style={{ fontSize: 10, color: "#b8b0a6" }}>{new Date(meta.at).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                                  </div>
                                )}
                              </div>
                            );
                          }
                        })}
                        <div style={{ marginTop: 10, borderTop: "1px dashed #e2ddd5", paddingTop: 10 }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: "#9c8e81", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>Step Note (optional)</div>
                          <input type="text" value={stepData.note || ""} maxLength={300}
                            placeholder={isLocked ? "" : `Add a note about Step ${step.num}…`}
                            readOnly={isLocked}
                            onChange={e => !isLocked && updateChecklistStep(r.id, step.num, "note", e.target.value)}
                            style={{ width: "100%", padding: "6px 10px", borderRadius: 6, border: "1px solid #d4cfc7", fontFamily: "inherit", fontSize: 13, color: "#1c3557", boxSizing: "border-box", outline: "none", background: isLocked ? "#f8fafc" : "white", cursor: isLocked ? "default" : "text" }} />
                        </div>
                      </div>
                    </div>
                  );
                })}

                <div style={{ marginTop: 20, padding: "20px 20px", background: isLocked ? (cl.overallStatus === "approved" ? "#f0fdf4" : "#fff5f5") : "#f7f5f1", borderRadius: 14, border: `1px solid ${isLocked ? (cl.overallStatus === "approved" ? "#86efac" : "#fca5a5") : "#e2ddd5"}` }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: "#1c3557" }}>📌 Final Decision</div>
                    {isLocked && (
                      <button onClick={() => updateChecklistMeta(r.id, "overallStatus", "pending")}
                        style={{ padding: "6px 16px", borderRadius: 20, border: "2px solid #f59e0b", background: "#fef3c7", color: "#92400e", fontFamily: "inherit", fontSize: 12, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                        🔓 Unlock to Edit
                      </button>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
                    {statusOpts.map(opt => (
                      <button key={opt.value}
                        onClick={() => !isLocked && updateChecklistMeta(r.id, "overallStatus", opt.value)}
                        disabled={isLocked && cl.overallStatus !== opt.value}
                        style={{ padding: "8px 18px", borderRadius: 20, border: `2px solid ${cl.overallStatus === opt.value ? opt.color : "#d4cfc7"}`, background: cl.overallStatus === opt.value ? opt.bg : "white", color: cl.overallStatus === opt.value ? opt.color : "#7c6f5e", fontFamily: "inherit", fontSize: 13, fontWeight: 800, cursor: isLocked ? "default" : "pointer", opacity: isLocked && cl.overallStatus !== opt.value ? 0.35 : 1 }}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#9c8e81", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>Decision Note / Rationale</div>
                  <textarea value={cl.finalNote || ""} maxLength={600}
                    placeholder={isLocked ? "" : "Explain the final decision, any conditions, or next steps…"}
                    readOnly={isLocked}
                    onChange={e => !isLocked && updateChecklistMeta(r.id, "finalNote", e.target.value)}
                    style={{ width: "100%", minHeight: 80, padding: "8px 12px", borderRadius: 8, border: "1px solid #d4cfc7", fontFamily: "inherit", fontSize: 13, color: "#1c3557", boxSizing: "border-box", resize: isLocked ? "none" : "vertical", outline: "none", background: isLocked ? (cl.overallStatus === "approved" ? "#f0fdf4" : "#fff5f5") : "white", cursor: isLocked ? "default" : "text" }} />
                </div>

                <div style={{ marginTop: 16, textAlign: "right" }}>
                  <button onClick={() => setChecklistResource(null)}
                    style={{ padding: "10px 28px", background: "#0d9488", color: "white", border: "none", borderRadius: 10, fontFamily: "inherit", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                    ✓ Done
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── TEACHER: Read-Only Approval Checklist Modal ── */}
      {viewChecklistResource && (() => {
        const r = viewChecklistResource;
        const cl = checklists[r.id] || { steps: {}, overallStatus: "pending", finalNote: "", lastUpdated: "" };
        const STEPS = [{"num": "1", "icon": "\ud83d\udc69\u200d\ud83c\udfeb", "title": "Before Using Any New Digital Resource", "role": "Teacher Quick Check", "items": [{"text": "Did you search the TrustED Apps Dashboard for this tool?", "type": "yn", "good": "yes"}, {"text": "Is the tool listed as Approved in TrustED Apps?", "type": "yn", "good": "yes"}, {"text": "Is the tool listed as Denied in TrustED Apps?", "type": "yn", "good": "no"}, {"text": "Is the tool NOT listed in TrustED Apps? (Proceed to Step 2)", "type": "yn", "good": "yes"}]}, {"num": "2", "icon": "\ud83d\udcdd", "title": "If the Tool Is NOT Listed", "role": "Teacher Action", "items": [{"text": "Did the teacher submit an IIQ (Instructional Inventory Questionnaire) Digital Resource Review Ticket to initiate the district review process?", "type": "yn", "good": "yes"}]}, {"num": "3", "icon": "\ud83c\udfdb\ufe0f", "title": "District / Admin Review Stage", "role": "Admin or Instructional Tech Team Checks", "items": [{"text": "Is the tool listed in the 1EdTech Catalog?", "type": "yn", "good": null}, {"text": "Did you update TrustED Apps and notify the teacher? (If yes in 1EdTech Catalog)", "type": "yn", "good": "yes"}, {"text": "Did you submit the tool to the 1EdTech Privacy Team for vetting? (If not in 1EdTech Catalog)", "type": "yn", "good": "yes"}]}, {"num": "4", "icon": "\ud83d\udd12", "title": "Privacy & Compliance Evaluation", "role": "District Technology / Compliance Team Reviews", "items": [{"text": "Does the tool collect student data? (FERPA requirement)", "type": "yn", "good": "no"}, {"text": "Does the vendor provide data privacy policies? (FERPA requirement)", "type": "yn", "good": "yes"}, {"text": "Is parental consent needed for students under 13? (COPPA requirement)", "type": "yn", "good": "no"}, {"text": "If the resource involves online content or browsing, does it comply with CIPA filtering expectations?", "type": "yn", "good": "yes"}, {"text": "Does the tool use or share data for advertising? (Schools cannot consent on behalf of parents for commercial data use)", "type": "yn", "good": "no"}, {"text": "General", "type": "section"}, {"text": "GENQ1 \u2014 How are changes to key policies managed?", "type": "mpu", "hint": "Ideal: Policies may be changed any time at their discretion, without notice to the user"}, {"text": "Data Collection", "type": "section"}, {"text": "DCQ1 \u2014 Do the policies list all data collected?", "type": "mpu", "hint": "Ideal: Policies give a broad statement of data collected OR policies are not clear on data collected crucial to app functionality"}, {"text": "DCQ2 \u2014 Do the policies indicate how data is collected?", "type": "mpu", "hint": "Ideal: Policies give a broad statement of how data is collected OR policies are not clear on how data is collected"}, {"text": "DCQ3 \u2014 Do the policies state who owns the data?", "type": "mpu", "hint": "Ideal: Policies do not state who owns the data OR policies state supplier owns all data"}, {"text": "DCQ4 \u2014 Do the policies allow users to delete their data entirely?", "type": "mpu", "hint": "Ideal: Policies allow users to delete data entirely after a period of time OR policies state no data collected"}, {"text": "DCQ5 \u2014 Do the policies state the retention of data?", "type": "mpu", "hint": "Ideal: Policies do not state its data retention policy OR policies state that data is retained for as long as supplier needs it"}, {"text": "Security", "type": "section"}, {"text": "SECQ1 \u2014 Do the policies state how data is protected?", "type": "mpu", "hint": "Ideal: Policies give a broad statement on steps taken to protect data OR policies are unclear on how data is protected"}, {"text": "SECQ2 \u2014 Do the policies state all confidential & sensitive information is encrypted throughout?", "type": "mpu", "hint": "Ideal: Data encrypted throughout OR passes an encryption test with no vulnerabilities OR policies state no data collected"}, {"text": "SECQ3 \u2014 Do the policies state whether or not it enforces strong password creation?", "type": "mpu", "hint": "Ideal: Supplier enforces strong password creation OR supplier user base exempt from password requirements OR no account creation required"}, {"text": "SECQ4 \u2014 Do the policies indicate whether or not it leverages 2-step (or other forms of multifactor) authentication?", "type": "mpu", "hint": "Ideal: Supplier uses SSO or an LTI launch OR no account creation is required OR supplier user base exempt from 2-step authentication requirements"}, {"text": "SECQ5 \u2014 Do the policies state the use of cookies?", "type": "mpu", "hint": "Ideal: Policies give a broad statement on the use of cookies OR policies are unclear if cookies are crucial for app functionality"}, {"text": "Third Party Data", "type": "section"}, {"text": "SHRQ1 \u2014 Do the policies state the use of third parties?", "type": "mpu", "hint": "Ideal: Policies list each third party separately OR policies state third party use strictly for app functionality OR policies state that they do not use third parties"}, {"text": "SHRQ2 \u2014 Do the policies state what information is shared with each third party?", "type": "mpu", "hint": "Ideal: Policies list the data it shares with each third party separately OR policies state that it does not share any data with any third party"}, {"text": "SHRQ3 \u2014 Do the policies state whether or not users can opt out of third party data sharing?", "type": "mpu", "hint": "Ideal: Policies include an easy opt out process for users OR policies state that it does not share any data with any third party"}, {"text": "SHRQ4 \u2014 Do the policies state if the supplier requires third parties to adhere to the terms of the vendor/customer agreement?", "type": "mpu", "hint": "Ideal: Supplier claims responsibility for third party privacy practices OR policies state that it does not share any data with any third party"}, {"text": "SHRQ5 \u2014 Do the policies state whether or not user is notified of a change in third parties?", "type": "mpu", "hint": "Ideal: Supplier changes third party and keeps the same data sharing terms OR supplier does not use any third parties"}, {"text": "Advertising", "type": "section"}, {"text": "ADVQ1 \u2014 Do the policies indicate if advertisements are displayed?", "type": "mpu", "hint": "Ideal: No ads are displayed"}, {"text": "ADVQ2 \u2014 Do the policies indicate whether or not users are targeted for advertisement?", "type": "mpu", "hint": "Ideal: Policies guarantee no ad targeting OR policies state no ads are used on its platform"}, {"text": "ADVQ3 \u2014 Do the policies indicate whether or not any third parties track or collect information for advertisement?", "type": "mpu", "hint": "Ideal: Policies state that third parties might track or collect user data but gives you the option to opt out OR users can opt out of ad networks"}, {"text": "ADVQ4 \u2014 Do the policies indicate whether or not web beacons or other tracking methods are used for ad purposes?", "type": "mpu", "hint": "Ideal: Policies state that it only tracks interactions within its application OR policies state that it does not use any tracking technologies for ads"}, {"text": "ADVQ5 \u2014 Do the policies state whether or not users can opt out of sharing data with advertisers?", "type": "mpu", "hint": "Ideal: Policies state in detail how users can opt out of sharing data with advertisers OR policies state no ads are used on its platform"}]}, {"num": "5", "icon": "\ud83c\udfaf", "title": "Droplet Review Process \u2014 Use Case & Instructional Value", "role": "Admin or Department Leader Confirms", "items": [{"text": "Does the tool have a clear instructional purpose?", "type": "yn", "good": "yes"}, {"text": "Is it non-redundant (no other approved tool provides the same function)?", "type": "yn", "good": "yes"}, {"text": "Is the tool high-quality and aligned with standards?", "type": "yn", "good": "yes"}]}, {"num": "6", "icon": "\ud83d\udccb", "title": "Vendor Requirements", "role": "District or Department Staff", "items": [{"text": "Did you submit the vendor request?", "type": "yn", "good": "yes"}, {"text": "Did the vendor complete required forms (privacy/security questionnaire, DPA if required)?", "type": "yn", "good": "yes"}, {"text": "Did the Technology Department validate FERPA alignment and overall compliance?", "type": "yn", "good": "yes"}, {"text": "Did the Technology Department verify CIPA-related content safety if applicable?", "type": "yn", "good": "yes"}]}, {"num": "7", "icon": "\u2705", "title": "Final Decision", "role": "District Leadership Sign-Off", "items": [{"text": "Did the Department Leader authorize the tool?", "type": "yn", "good": "yes"}, {"text": "Did the Technology Department validate compliance?", "type": "yn", "good": "yes"}, {"text": "Has the TrustED Apps Dashboard been updated (Approved or Denied)?", "type": "yn", "good": "yes"}, {"text": "Has the teacher received notification of the approval status?", "type": "yn", "good": "yes"}]}, {"num": "8", "icon": "\ud83c\udf93", "title": "After Approval", "role": "Teacher Responsibilities", "items": [{"text": "Is the resource being used according to approved guidelines?", "type": "yn", "good": "yes"}, {"text": "Have settings or permissions been kept as approved (no unauthorized changes)?", "type": "yn", "good": "yes"}, {"text": "Have you notified admin if the tool starts collecting new types of data?", "type": "yn", "good": "yes"}, {"text": "Are digital citizenship requirements being followed if applicable (CIPA digital literacy expectation)?", "type": "yn", "good": "yes"}, {"text": "Has parent communication been provided if required by district policy (FERPA expectation for transparency)?", "type": "yn", "good": "yes"}]}, {"num": "9", "icon": "\ud83d\udeab", "title": "If Denied", "role": "Teacher Guidance", "items": [{"text": "Did you refrain from using the tool?", "type": "yn", "good": "yes"}, {"text": "Did you review recommended alternate approved resources?", "type": "yn", "good": "yes"}, {"text": "Did you consult with the Instructional Tech Team for alternatives?", "type": "yn", "good": "yes"}]}];
        const countableT = (s) => s.items.filter(i => i.type !== "section");
        const totalItemsT = STEPS.reduce((acc, s) => acc + countableT(s).length, 0);
        const answeredItems = STEPS.reduce((acc, s) => acc + countableT(s).filter(item => cl.steps?.[s.num]?.items?.[s.items.indexOf(item)] != null).length, 0);
        const statusConfig = {
          approved: { bg: "#d1fae5", color: "#065f46", label: "✓ Approved",   headerBg: "linear-gradient(135deg, #065f46, #059669)" },
          denied:   { bg: "#fee2e2", color: "#991b1b", label: "✕ Denied",     headerBg: "linear-gradient(135deg, #7f1d1d, #dc2626)" },
          pending:  { bg: "#fef9c3", color: "#854d0e", label: "⏳ In Review", headerBg: "linear-gradient(135deg, #1c3557, #3b6fba)" },
        };
        const sc = statusConfig[cl.overallStatus || "pending"];
        return (
          <div onClick={() => setViewChecklistResource(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 9100, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "32px 16px", overflowY: "auto" }}>
            <div onClick={e => e.stopPropagation()} style={{ background: "white", borderRadius: 20, maxWidth: 700, width: "100%", boxShadow: "0 24px 80px rgba(0,0,0,0.25)", overflow: "hidden" }}>
              <div style={{ background: sc.headerBg, padding: "24px 32px", display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.7)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>District Approval Status</div>
                  <h2 style={{ margin: 0, color: "white", fontSize: 20, fontWeight: 800 }}>📋 {r.name}</h2>
                  <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 8, flexWrap: "wrap" }}>
                    <span style={{ display: "inline-block", padding: "4px 14px", borderRadius: 20, background: "rgba(255,255,255,0.2)", color: "white", fontSize: 12, fontWeight: 700 }}>{sc.label}</span>
                    <span style={{ fontSize: 12, color: "rgba(255,255,255,0.75)" }}>{answeredItems} of {totalItemsT} items complete</span>
                  </div>
                </div>
                <button onClick={() => setViewChecklistResource(null)} style={{ background: "rgba(255,255,255,0.15)", border: "none", color: "white", fontSize: 20, width: 36, height: 36, borderRadius: "50%", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>✕</button>
              </div>
              <div style={{ background: "#e2ddd5", height: 6 }}>
                <div style={{ height: "100%", background: cl.overallStatus === "approved" ? "#059669" : cl.overallStatus === "denied" ? "#dc2626" : "#3b6fba", width: totalItemsT > 0 ? `${(answeredItems / totalItemsT) * 100}%` : "0%", transition: "width 0.3s ease" }} />
              </div>

              <div style={{ padding: "24px 32px", maxHeight: "68vh", overflowY: "auto" }}>
                {cl.lastUpdated && (
                  <div style={{ marginBottom: 16, fontSize: 12, color: "#9c8e81", textAlign: "right" }}>
                    Last updated: {new Date(cl.lastUpdated).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                  </div>
                )}
                {STEPS.map(step => {
                  const stepData = cl.steps?.[step.num] || { items: {}, note: "" };
                  const countableStep = step.items.filter(i => i.type !== "section");
                  const answered = countableStep.filter(item => { const ri = step.items.indexOf(item); return stepData.items?.[ri] != null; }).length;
                  const stepDone = answered === countableStep.length;
                  const anyAnswered = answered > 0;
                  return (
                    <div key={step.num} style={{ marginBottom: 12, borderRadius: 10, border: `1px solid ${stepDone ? "#6ee7b7" : anyAnswered ? "#fcd34d" : "#e2ddd5"}`, overflow: "hidden" }}>
                      <div style={{ padding: "10px 14px", background: stepDone ? "#f0fdfa" : anyAnswered ? "#fffbeb" : "#fafaf9", display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 24, height: 24, borderRadius: "50%", background: stepDone ? "#0d9488" : anyAnswered ? "#d97706" : "#e2ddd5", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          {stepDone ? <span style={{ color: "white", fontSize: 11 }}>✓</span> : <span style={{ fontWeight: 800, fontSize: 11, color: anyAnswered ? "white" : "#9c8e81" }}>{step.num}</span>}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: stepDone ? "#0f766e" : anyAnswered ? "#92400e" : "#7c6f5e" }}>{step.icon} Step {step.num}: {step.title}</div>
                          <div style={{ fontSize: 11, color: "#9c8e81" }}>{step.role} · {answered}/{step.items.length} complete</div>
                        </div>
                      </div>
                      {anyAnswered && (
                        <div style={{ padding: "8px 14px 10px", background: "white", borderTop: `1px dashed ${stepDone ? "#6ee7b7" : "#fcd34d"}` }}>
                          {step.items.map((item, idx) => {
                            const val = stepData.items?.[idx];
                            if (item.type === "section") {
                              // Only show section header if at least one item in this section has a value
                              const sectionItems = [];
                              for (let i = idx + 1; i < step.items.length && step.items[i].type !== "section"; i++) sectionItems.push(i);
                              const hasAnswered = sectionItems.some(i => stepData.items?.[i] != null);
                              if (!hasAnswered) return null;
                              return (
                                <div key={idx} style={{ margin: "10px 0 6px", paddingBottom: 3, borderBottom: "1px solid #e2ddd5" }}>
                                  <span style={{ fontSize: 10, fontWeight: 800, color: "#9c8e81", textTransform: "uppercase", letterSpacing: "0.8px" }}>{item.text}</span>
                                </div>
                              );
                            }
                            if (val == null) return null;
                            if (item.type === "mpu") {
                              const MPU = { met: { bg: "#d1fae5", color: "#065f46", label: "Met" }, partially: { bg: "#fef3c7", color: "#92400e", label: "Partially" }, unmet: { bg: "#fee2e2", color: "#991b1b", label: "Unmet" }, na: { bg: "#e2e8f0", color: "#475569", label: "N/A" } };
                              const s = MPU[val];
                              const answerText = stepData.answers?.[idx];
                              return (
                                <div key={idx} style={{ marginBottom: 8 }}>
                                  <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                                    <span style={{ fontSize: 11, fontWeight: 800, padding: "2px 8px", borderRadius: 20, background: s?.bg || "#e2e8f0", color: s?.color || "#475569", flexShrink: 0, marginTop: 1, whiteSpace: "nowrap" }}>
                                      {s?.label || val}
                                    </span>
                                    <span style={{ fontSize: 12, color: "#3c3529", lineHeight: 1.5 }}>{item.text}</span>
                                  </div>
                                  {answerText && (
                                    <div style={{ marginTop: 4, marginLeft: 72, padding: "5px 10px", background: "#f7f5f1", borderRadius: 6, fontSize: 12, color: "#3c3529", lineHeight: 1.5, borderLeft: "3px solid #d4cfc7", fontStyle: "italic" }}>
                                      {answerText}
                                    </div>
                                  )}
                                </div>
                              );
                            }
                            if (item.type === "yn") {
                              const isNA   = val === "na";
                              const isGood = !isNA && val === item.good;
                              return (
                                <div key={idx} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
                                  <span style={{ fontSize: 11, fontWeight: 800, padding: "2px 8px", borderRadius: 20, background: isNA ? "#e2e8f0" : isGood ? "#d1fae5" : "#fee2e2", color: isNA ? "#475569" : isGood ? "#065f46" : "#991b1b", flexShrink: 0, marginTop: 1 }}>
                                    {isNA ? "N/A" : val === "yes" ? "Yes" : "No"}
                                  </span>
                                  <span style={{ fontSize: 12, color: isNA ? "#64748b" : "#3c3529", lineHeight: 1.5, fontStyle: isNA ? "italic" : "normal" }}>{item.text}</span>
                                </div>
                              );
                            } else {
                              const isNA = val === "na";
                              return (
                                <div key={idx} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
                                  {isNA ? (
                                    <span style={{ fontSize: 11, fontWeight: 800, padding: "2px 8px", borderRadius: 20, background: "#e2e8f0", color: "#475569", flexShrink: 0, marginTop: 1 }}>N/A</span>
                                  ) : (
                                    <div style={{ width: 16, height: 16, borderRadius: 3, background: "#0d9488", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}>
                                      <span style={{ color: "white", fontSize: 10 }}>✓</span>
                                    </div>
                                  )}
                                  <span style={{ fontSize: 12, color: isNA ? "#64748b" : "#0f766e", lineHeight: 1.5, fontStyle: isNA ? "italic" : "normal" }}>{item.text}</span>
                                </div>
                              );
                            }
                          })}
                          {stepData.note && (
                            <div style={{ marginTop: 8, padding: "6px 10px", background: "#f7f5f1", borderRadius: 6, fontSize: 12, color: "#3c3529", fontStyle: "italic", borderLeft: "3px solid #d4cfc7" }}>
                              📝 {stepData.note}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {(cl.overallStatus !== "pending" || cl.finalNote) && (
                  <div style={{ marginTop: 16, padding: "16px 20px", background: sc.bg, borderRadius: 12, border: `1px solid ${cl.overallStatus === "approved" ? "#6ee7b7" : cl.overallStatus === "denied" ? "#fca5a5" : "#fcd34d"}` }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: sc.color, marginBottom: cl.finalNote ? 8 : 0 }}>📌 Final Decision: {sc.label}</div>
                    {cl.finalNote && <div style={{ fontSize: 13, color: "#3c3529", lineHeight: 1.7 }}>{cl.finalNote}</div>}
                  </div>
                )}

                {answeredItems === 0 && !cl.finalNote && (
                  <div style={{ textAlign: "center", padding: "20px", color: "#9c8e81", fontSize: 13 }}>
                    The district review process has not yet started for this resource.
                  </div>
                )}

                <div style={{ marginTop: 16, padding: "10px 14px", background: "#f7f5f1", borderRadius: 8, fontSize: 11, color: "#9c8e81", lineHeight: 1.6 }}>
                  ℹ️ This checklist is maintained by district administrators. Contact your instructional technology office with questions about the approval status of any resource.
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {showApprovalProcess && (
        <div onClick={() => setShowApprovalProcess(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 9000, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "32px 16px", overflowY: "auto" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "white", borderRadius: 20, maxWidth: 860, width: "100%", boxShadow: "0 24px 80px rgba(0,0,0,0.25)", overflow: "hidden" }}>

            {/* Header */}
            <div style={{ background: "linear-gradient(135deg, #0f766e 0%, #0d9488 100%)", padding: "28px 36px", display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#99f6e4", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Process Guide</div>
                <h2 style={{ margin: 0, color: "white", fontSize: 24, fontWeight: 800 }}>✅ Approving a New Resource for Student Use</h2>
                <p style={{ margin: "6px 0 0", color: "#ccfbf1", fontSize: 13 }}>Step-by-step guidance for evaluating and approving new ed tech tools</p>
              </div>
              <button onClick={() => setShowApprovalProcess(false)} style={{ background: "rgba(255,255,255,0.15)", border: "none", color: "white", fontSize: 20, width: 36, height: 36, borderRadius: "50%", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>✕</button>
            </div>

            {/* Body */}
            <div style={{ padding: "32px 36px", maxHeight: "72vh", overflowY: "auto" }}>

              {/* Intro callout */}
              <div style={{ marginBottom: 28, padding: "14px 18px", background: "#f0fdfa", borderRadius: 12, border: "1px solid #5eead4", fontSize: 13, color: "#0f766e", lineHeight: 1.8 }}>
                <strong>Purpose:</strong> Before a digital tool can be used with students, it must pass a review process that ensures compliance with FERPA, COPPA, and CIPA. This guide walks through each step so teachers know what to expect and how to prepare.
              </div>

              {[
                {
                  num: "1", icon: "🔍", title: "Determine Whether the Resource Collects or Uses Student Data",
                  color: "#1e3a5f", bg: "#eff6ff", border: "#93c5fd", actionBg: "#dbeafe", actionColor: "#1e40af",
                  body: "Before anything else, find out what information the tool collects — accounts, names, emails, usage data, uploads, etc.",
                  points: [
                    { law: "FERPA", cite: "20 U.S.C. §1232g", text: "Requires that any educational records shared with a third party must be protected and may require written agreements." },
                    { law: "COPPA", cite: "15 U.S.C. §6502", text: "Requires parental consent if the tool collects data from children under 13, unless the school provides consent for educational use only." },
                  ],
                  action: "👉 Check the vendor's privacy policy, data collection list, and terms of use."
                },
                {
                  num: "2", icon: "🛡️", title: "Verify the Vendor's Privacy Compliance",
                  color: "#4c1d95", bg: "#f5f3ff", border: "#c4b5fd", actionBg: "#ede9fe", actionColor: "#5b21b6",
                  body: "Look for whether the vendor meets FERPA, COPPA, and (if applicable) CIPA requirements. Key indicators include:",
                  bullets: [
                    "Clear privacy policy explaining data use (COPPA requirement)",
                    "Strong data safeguards for stored student information (FERPA expectation)",
                    "Data deletion practices",
                    "No use of personal data for advertising (COPPA restriction — schools cannot consent for commercial use)",
                  ],
                  action: "👉 If the tool collects any student personal data, it must undergo a data privacy review."
                },
                {
                  num: "3", icon: "👪", title: "Determine Whether Parental Consent Is Needed (COPPA)",
                  color: "#7f1d1d", bg: "#fef2f2", border: "#fca5a5", actionBg: "#fee2e2", actionColor: "#991b1b",
                  body: "If the tool is for students under 13, check whether the vendor requires verifiable parental consent OR the school can act as the parent's agent for educational purposes only.",
                  note: "The school cannot consent on behalf of parents if the vendor uses student information for advertising, commercial profiling, or non-educational purposes.",
                  action: "👉 If the tool uses data inappropriately, do not approve it."
                },
                {
                  num: "4", icon: "📄", title: "Complete a Data Privacy Agreement (DPA) or Vendor Contract",
                  color: "#0f766e", bg: "#f0fdfa", border: "#5eead4", actionBg: "#ccfbf1", actionColor: "#0f766e",
                  body: "Most districts require a signed agreement that covers:",
                  bullets: [
                    "Who owns the data (it should be the school/district)",
                    "How the vendor stores, uses, and deletes the data",
                    "What happens in case of a breach",
                    "FERPA compliance assurances",
                  ],
                  note: "Districts nationwide use DPAs because FERPA demands strict controls over third-party access. Laws like AB 1584 also require clear terms on data ownership, deletion, and breach notification.",
                  action: "👉 Submit the resource to your district's instructional technology or data privacy office to generate or verify a DPA."
                },
                {
                  num: "5", icon: "🌐", title: "Check for CIPA Requirements (If Internet-Based)",
                  color: "#065f46", bg: "#ecfdf5", border: "#6ee7b7", actionBg: "#d1fae5", actionColor: "#065f46",
                  body: "If the resource involves internet browsing, online communication, or user-generated content — CIPA applies if your school uses E-Rate funding. E-Rate schools must filter inappropriate content, provide digital citizenship instruction, and ensure safe internet use monitoring.",
                  action: "👉 Verify the tool won't bypass web filters and aligns with existing digital safety policies."
                },
                {
                  num: "6", icon: "🏛️", title: "Submit the Tool for District Review / Approval",
                  color: "#1e3a5f", bg: "#eff6ff", border: "#93c5fd", actionBg: "#dbeafe", actionColor: "#1e40af",
                  body: "Most districts require teachers to fill out a request form reviewed by instructional technology staff, data privacy/security team, and curriculum coordinators. They check instructional value, accessibility, data privacy compliance, and network/security issues.",
                  action: "👉 Follow your district's formal tool-adoption workflow (usually a ticket, form, or internal portal)."
                },
                {
                  num: "7", icon: "📬", title: "Provide Parent Communication If Required",
                  color: "#92400e", bg: "#fffbeb", border: "#fcd34d", actionBg: "#fef3c7", actionColor: "#92400e",
                  body: "If the tool requires student accounts, collects PII, or is used with students under 13 — you may need to notify families of what data is collected, why the tool is used, and how data is protected.",
                  note: "This aligns with FERPA's annual notification expectations and COPPA requirements.",
                  action: "👉 Prepare a parent notice or use this tool's PDF disclosure feature to document and communicate data practices."
                },
                {
                  num: "8", icon: "🎓", title: "Train Students on How to Use the Tool Safely",
                  color: "#065f46", bg: "#ecfdf5", border: "#6ee7b7", actionBg: "#d1fae5", actionColor: "#065f46",
                  body: "Part of CIPA compliance (for E-Rate schools) includes digital citizenship lessons and online safety training. Even if not required, it's always best practice.",
                  action: "👉 Integrate online safety discussion when introducing any new digital tool to students."
                },
              ].map(step => (
                <div key={step.num} style={{ marginBottom: 24, borderRadius: 14, border: `1px solid ${step.border}`, overflow: "hidden" }}>
                  <div style={{ background: step.bg, padding: "14px 20px", display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 32, height: 32, borderRadius: "50%", background: step.color, color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 15, flexShrink: 0 }}>{step.num}</div>
                    <span style={{ fontSize: 15, fontWeight: 800, color: step.color }}>{step.icon} {step.title}</span>
                  </div>
                  <div style={{ padding: "14px 20px", fontSize: 13, color: "#3c3529", lineHeight: 1.8 }}>
                    <p style={{ margin: "0 0 10px" }}>{step.body}</p>
                    {step.points && step.points.map((p, i) => (
                      <div key={i} style={{ marginBottom: 8, padding: "8px 12px", background: step.actionBg, borderRadius: 8, borderLeft: `3px solid ${step.border}` }}>
                        <strong style={{ color: step.color }}>{p.law}</strong> <span style={{ fontSize: 11, color: "#7c6f5e" }}>[{p.cite}]</span> — {p.text}
                      </div>
                    ))}
                    {step.bullets && (
                      <ul style={{ margin: "0 0 10px", paddingLeft: 20 }}>
                        {step.bullets.map((b, i) => <li key={i} style={{ marginBottom: 4 }}>{b}</li>)}
                      </ul>
                    )}
                    {step.note && <div style={{ marginBottom: 10, padding: "8px 12px", background: "#f7f5f1", borderRadius: 8, fontSize: 12, color: "#7c6f5e", fontStyle: "italic" }}>{step.note}</div>}
                    <div style={{ padding: "8px 14px", background: step.actionBg, borderRadius: 8, fontWeight: 700, color: step.actionColor, fontSize: 13 }}>{step.action}</div>
                  </div>
                </div>
              ))}

              {/* Summary flowchart */}
              <div style={{ marginTop: 8, padding: "20px 24px", background: "#f0fdfa", borderRadius: 14, border: "1px solid #5eead4" }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: "#0f766e", marginBottom: 14 }}>✅ Summary Flowchart (Teacher-Friendly)</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {["Identify the resource","Check if it collects student data","Review privacy policy & data use","Confirm FERPA compliance","Check COPPA rules (if under 13)","Verify CIPA relevance (if internet-based in E-Rate schools)","Submit for district approval / DPA review","Notify parents (if required)","Teach digital safety & implement"].map((step, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 26, height: 26, borderRadius: "50%", background: "#0d9488", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 12, flexShrink: 0 }}>{i + 1}</div>
                      <div style={{ fontSize: 13, color: "#134e4a", fontWeight: 600 }}>{step}</div>
                      {i < 8 && <div style={{ fontSize: 16, color: "#5eead4", marginLeft: "auto" }}>↓</div>}
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {showClassroomVsExtra && (
        <div onClick={() => setShowClassroomVsExtra(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 9000, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "32px 16px", overflowY: "auto" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "white", borderRadius: 20, maxWidth: 860, width: "100%", boxShadow: "0 24px 80px rgba(0,0,0,0.25)", overflow: "hidden" }}>

            {/* Header */}
            <div style={{ background: "linear-gradient(135deg, #78350f 0%, #d97706 100%)", padding: "28px 36px", display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#fde68a", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Guidance Reference</div>
                <h2 style={{ margin: 0, color: "white", fontSize: 24, fontWeight: 800 }}>🏫 Classroom vs. Extracurricular Use</h2>
                <p style={{ margin: "6px 0 0", color: "#fef3c7", fontSize: 13 }}>Why a denied app might still be permitted for clubs, athletics, and voluntary activities</p>
              </div>
              <button onClick={() => setShowClassroomVsExtra(false)} style={{ background: "rgba(255,255,255,0.15)", border: "none", color: "white", fontSize: 20, width: 36, height: 36, borderRadius: "50%", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>✕</button>
            </div>

            {/* Body */}
            <div style={{ padding: "32px 36px", maxHeight: "72vh", overflowY: "auto" }}>

              {/* Intro callout */}
              <div style={{ marginBottom: 28, padding: "14px 18px", background: "#fffbeb", borderRadius: 12, border: "1px solid #fcd34d", fontSize: 13, color: "#78350f", lineHeight: 1.8 }}>
                <strong>Key Principle:</strong> An application denied for instructional classroom use might still be permitted for clubs or athletic teams — but only under specific conditions. The voluntary nature of extracurricular participation changes the legal analysis, though FERPA, COPPA, and CIPA still apply in important ways.
              </div>

              {/* Section 1 */}
              {[
                {
                  num: "1", title: "Why an App Might Be Denied for Classroom Use",
                  color: "#7f1d1d", bg: "#fef2f2", border: "#fca5a5", citeBg: "#fff1f2", citeColor: "#be123c",
                  intro: "When a district reviews software for instructional use, it must evaluate compliance with multiple federal and state laws. Instructional tools face stricter requirements because they may store education records, integrate with district systems, collect grades or assignments, or be required for class participation.",
                  blocks: [
                    { label: "FERPA", cite: "20 U.S.C. §1232g(b)(1)", desc: "Prohibits disclosure of student education records without written consent." },
                    { label: "FERPA — Vendor Exception", cite: "34 CFR §99.31(a)(1)", desc: "Allows disclosure to vendors acting as school officials with a legitimate educational interest — but only if a Student Data Privacy Agreement (SDPA) is in place." },
                  ],
                  laws: ["Family Educational Rights and Privacy Act (FERPA)", "Children's Online Privacy Protection Act (COPPA)", "Children's Internet Protection Act (CIPA)", "Georgia Student Data Privacy, Accessibility, and Transparency Act (SDPA)"],
                  lawLabel: "Laws districts commonly require compliance with:",
                  note: "💡 If a vendor refuses to sign a Student Data Privacy Agreement, most districts will deny the tool for classroom use."
                },
                {
                  num: "2", title: "Extracurricular Activities Are Treated Differently",
                  color: "#1e3a5f", bg: "#eff6ff", border: "#93c5fd", citeBg: "#dbeafe", citeColor: "#1e40af",
                  intro: "Clubs, athletics, and organizations (like FBLA or esports teams) are typically voluntary activities. Because participation is not required for academic standing, the legal analysis changes. The platform may function as a third-party service used by participants rather than as an instructional vendor under district control.",
                  examples: ["TeamSnap", "Discord", "GroupMe", "Band", "SportsYou"],
                  examplesLabel: "Common extracurricular platforms:",
                  note: "📋 Because participation is voluntary, schools often rely on parent permission forms rather than full vendor data agreements."
                },
                {
                  num: "3", title: "COPPA Still Applies for Students Under 13",
                  color: "#4c1d95", bg: "#f5f3ff", border: "#c4b5fd", citeBg: "#ede9fe", citeColor: "#6d28d9",
                  intro: "The Children's Online Privacy Protection Act governs all online data collection from children under 13, regardless of whether the context is instructional or extracurricular.",
                  blocks: [
                    { label: "Definition of Child", cite: "15 U.S.C. §6501(1)", desc: "Defines a \"child\" as an individual under the age of 13." },
                    { label: "Parental Consent Requirement", cite: "15 U.S.C. §6502(b)(1)(A)", desc: "Requires verifiable parental consent before collecting personal information from a child." },
                    { label: "School Authorization Limit", cite: "16 CFR §312.5(c)", desc: "School authorization on behalf of parents applies only when data is collected solely for the use and benefit of the school — not for general club or extracurricular purposes." },
                  ],
                  note: "⚠️ For middle school clubs (students under 13): parents must consent directly — the school cannot provide COPPA consent on behalf of parents for extracurricular apps. For high school clubs (students 13+): COPPA generally does not apply."
                },
                {
                  num: "4", title: "FERPA Still Limits What Information Can Be Shared",
                  color: "#1c3557", bg: "#eff6ff", border: "#93c5fd", citeBg: "#dbeafe", citeColor: "#1e40af",
                  intro: "Even when an app is used for extracurricular activities, FERPA still applies if school education records are shared with it.",
                  blocks: [
                    { label: "Education Records Protection", cite: "20 U.S.C. §1232g(b)(1)", desc: "Protects education records from disclosure without written consent." },
                    { label: "Consent Requirement", cite: "34 CFR §99.30", desc: "Requires written consent from parents (or eligible students) before disclosing education records to third parties." },
                    { label: "Directory Information Exception", cite: "34 CFR §99.37", desc: "Allows release of designated directory information (such as name, grade level, and participation in activities) if parents were given prior annual notice and opt-out opportunity." },
                  ],
                  avoidList: ["Grades or academic performance data", "Discipline or behavioral records", "Student ID numbers", "Special education documentation"],
                  avoidLabel: "Advisors should avoid uploading to extracurricular apps without consent:"
                },
                {
                  num: "5", title: "CIPA Still Governs Internet Access on School Networks",
                  color: "#064e3b", bg: "#ecfdf5", border: "#6ee7b7", citeBg: "#d1fae5", citeColor: "#065f46",
                  intro: "The Children's Internet Protection Act applies whenever students access apps or websites on the school network — regardless of whether the purpose is instructional or extracurricular.",
                  blocks: [
                    { label: "Technology Protection Measures", cite: "47 U.S.C. §254(h)(5)(B)", desc: "Requires technology protection measures that filter harmful content on school internet systems — applies to all student internet use on school networks." },
                  ],
                  note: "🌐 CIPA affects network-level access controls, not parental consent. An app permitted for extracurricular use must still be accessible through the school's filtered network."
                },
              ].map(section => (
                <div key={section.num} style={{ marginBottom: 30 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                    <div style={{ width: 32, height: 32, background: section.color, color: "white", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 15, flexShrink: 0 }}>{section.num}</div>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: section.color }}>{section.title}</h3>
                  </div>
                  <p style={{ margin: "0 0 12px 44px", fontSize: 13, color: "#3c3529", lineHeight: 1.75 }}>{section.intro}</p>

                  {section.lawLabel && (
                    <div style={{ marginLeft: 44, marginBottom: 12 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#7c6f5e", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>{section.lawLabel}</div>
                      <ul style={{ margin: 0, paddingLeft: 18 }}>{section.laws.map(l => <li key={l} style={{ fontSize: 13, color: "#3c3529", lineHeight: 1.8 }}>{l}</li>)}</ul>
                    </div>
                  )}

                  {section.blocks?.map((b, i) => (
                    <div key={i} style={{ marginLeft: 44, marginBottom: 8, padding: "9px 13px", background: section.citeBg, borderRadius: 10, borderLeft: `3px solid ${section.border}` }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: section.citeColor, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>{b.label}</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: section.color, marginBottom: 3, fontFamily: "monospace" }}>{b.cite}</div>
                      <div style={{ fontSize: 13, color: "#5c5044", lineHeight: 1.6 }}>{b.desc}</div>
                    </div>
                  ))}

                  {section.examplesLabel && (
                    <div style={{ marginLeft: 44, marginBottom: 12 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#7c6f5e", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>{section.examplesLabel}</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {section.examples.map(ex => <span key={ex} style={{ fontSize: 12, fontWeight: 700, background: "#dbeafe", color: "#1e40af", padding: "3px 10px", borderRadius: 12 }}>{ex}</span>)}
                      </div>
                    </div>
                  )}

                  {section.avoidLabel && (
                    <div style={{ marginLeft: 44, marginBottom: 12 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#7c6f5e", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>{section.avoidLabel}</div>
                      <ul style={{ margin: 0, paddingLeft: 18 }}>{section.avoidList.map(item => <li key={item} style={{ fontSize: 13, color: "#7f1d1d", lineHeight: 1.8 }}>🚫 {item}</li>)}</ul>
                    </div>
                  )}

                  {section.note && (
                    <div style={{ marginLeft: 44, marginTop: 10, padding: "9px 14px", background: "#fef3c7", borderRadius: 8, border: "1px solid #fcd34d", fontSize: 13, color: "#92400e", lineHeight: 1.65 }}>{section.note}</div>
                  )}
                </div>
              ))}

              {/* Practical Examples Table */}
              <div style={{ borderTop: "2px solid #e2ddd5", paddingTop: 24, marginTop: 4, marginBottom: 24 }}>
                <h3 style={{ margin: "0 0 14px", fontSize: 16, fontWeight: 800, color: "#78350f" }}>📊 Practical Examples</h3>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "#78350f" }}>
                      <th style={{ padding: "9px 14px", color: "white", textAlign: "left", fontWeight: 700 }}>Situation</th>
                      <th style={{ padding: "9px 14px", color: "white", textAlign: "left", fontWeight: 700 }}>Could It Be Allowed?</th>
                      <th style={{ padding: "9px 14px", color: "white", textAlign: "left", fontWeight: 700 }}>Why</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["App denied for classroom assignments", "Possibly, for extracurricular use", "Voluntary participation + parent consent changes the legal framework"],
                      ["Discord used by esports team", "Possibly", "Voluntary activity — parent permission form may be sufficient"],
                      ["GroupMe for FBLA announcements", "Possibly", "Only directory information shared (names, activity participation)"],
                      ["App denied due to security breach", "Likely no", "Security risk remains regardless of instructional vs. extracurricular context"],
                      ["Middle school club app (students under 13)", "Possibly, with direct parent COPPA consent", "School cannot provide COPPA consent for non-instructional extracurricular apps"],
                      ["High school club app (students 13+)", "Possibly, with district approval", "COPPA does not apply; FERPA and CIPA still must be considered"],
                    ].map(([sit, allowed, why], i) => (
                      <tr key={i} style={{ background: i % 2 === 0 ? "#fafafa" : "white" }}>
                        <td style={{ padding: "9px 14px", color: "#3c3529", borderBottom: "1px solid #e2ddd5", fontWeight: 600 }}>{sit}</td>
                        <td style={{ padding: "9px 14px", color: allowed.startsWith("Likely no") ? "#7f1d1d" : "#065f46", borderBottom: "1px solid #e2ddd5", fontWeight: 700 }}>{allowed}</td>
                        <td style={{ padding: "9px 14px", color: "#5c5044", borderBottom: "1px solid #e2ddd5" }}>{why}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Key Takeaway */}
              <div style={{ padding: "18px 20px", background: "#fffbeb", borderRadius: 12, border: "2px solid #fcd34d" }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: "#78350f", marginBottom: 10 }}>✅ Key Takeaway</div>
                <p style={{ margin: "0 0 10px", fontSize: 13, color: "#78350f", lineHeight: 1.7 }}>A denied instructional app <em>might</em> still be used for clubs or teams if all of the following are true:</p>
                {["Participation is voluntary", "Parent consent is obtained when required (especially for students under 13)", "FERPA-protected records are not disclosed to the app", "District policy permits the use", "The security risk that caused the denial does not still apply"].map((item, i) => (
                  <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 6 }}>
                    <div style={{ width: 22, height: 22, background: "#78350f", color: "white", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 11, flexShrink: 0, marginTop: 1 }}>{i + 1}</div>
                    <span style={{ fontSize: 13, color: "#78350f", lineHeight: 1.7 }}>{item}</span>
                  </div>
                ))}
              </div>

              {/* Disclaimer */}
              <div style={{ marginTop: 20, padding: "12px 16px", background: "#f1f5f9", borderRadius: 10, border: "1px solid #cbd5e1", fontSize: 12, color: "#475569", lineHeight: 1.7 }}>
                <strong>Disclaimer:</strong> This guidance is for informational purposes only and reflects general interpretations of FERPA, COPPA, CIPA, and Georgia state law. Individual situations may vary. Consult your district's legal counsel before permitting denied applications for any use.
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: "16px 36px", borderTop: "1px solid #e2ddd5", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#faf8f5" }}>
              <span style={{ fontSize: 12, color: "#9c8e81" }}>References: FERPA (20 U.S.C. §1232g) · COPPA (15 U.S.C. §6501) · CIPA (47 U.S.C. §254)</span>
              <button onClick={() => setShowClassroomVsExtra(false)} style={{ padding: "9px 24px", background: "#78350f", color: "white", border: "none", borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ── PRINT-ONLY CLONE (mirrors #pdf-doc) ────────────────────────────── */}
      {/* The window.print() call will hide #app-shell via @media print and show only the white page */}

      {/* ── CIPA MODAL ──────────────────────────────────────────────────────── */}
      {showCipa && (
        <div onClick={() => setShowCipa(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 9000, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "32px 16px", overflowY: "auto" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "white", borderRadius: 20, maxWidth: 860, width: "100%", boxShadow: "0 24px 80px rgba(0,0,0,0.25)", overflow: "hidden" }}>

            {/* Header */}
            <div style={{ background: "linear-gradient(135deg, #064e3b 0%, #059669 100%)", padding: "28px 36px", display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#a7f3d0", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Federal Law Reference</div>
                <h2 style={{ margin: 0, color: "white", fontSize: 24, fontWeight: 800 }}>🌐 CIPA Protections</h2>
                <p style={{ margin: "6px 0 0", color: "#d1fae5", fontSize: 13 }}>Children's Internet Protection Act — 47 U.S.C. §254(h) &amp; (l) &amp; 47 CFR §54.520</p>
              </div>
              <button onClick={() => setShowCipa(false)} style={{ background: "rgba(255,255,255,0.15)", border: "none", color: "white", fontSize: 20, width: 36, height: 36, borderRadius: "50%", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>✕</button>
            </div>

            {/* Body */}
            <div style={{ padding: "32px 36px", maxHeight: "72vh", overflowY: "auto" }}>

              {/* E-Rate context banner */}
              <div style={{ marginBottom: 24, padding: "12px 16px", background: "#ecfdf5", borderRadius: 10, border: "1px solid #6ee7b7", fontSize: 13, color: "#065f46", lineHeight: 1.7 }}>
                <strong>📡 E-Rate Context:</strong> CIPA requirements apply to schools and libraries that receive E-Rate discounts (federal universal service funding) for internet access or internal connections. Compliance is certified via FCC Form 486.
              </div>

              {[
                {
                  num: "1", title: "Requirement to Block Harmful Online Content",
                  intro: "Schools and libraries must use technology protection measures (internet filters) to block access to certain types of content.",
                  blocks: [
                    { label: "Legal Requirement — Schools", cite: "47 U.S.C. §254(h)(5)(B)", desc: "Requires schools receiving E-Rate discounts to implement technology protection measures (filtering) on computers with internet access." },
                    { label: "Legal Requirement — Libraries", cite: "47 U.S.C. §254(h)(6)(B)", desc: "Applies the same technology protection measure requirements to libraries receiving E-Rate discounts." },
                    { label: "Regulatory Implementation", cite: "47 CFR §54.520(c)(1)", desc: "Requires technology protection measures to block or filter internet access to visual depictions that are obscene, child pornography, or harmful to minors." },
                  ],
                  list: { label: "Filters must block visual depictions that are:", items: ["Obscene content", "Child pornography", "Content harmful to minors (for minor users)"] }
                },
                {
                  num: "2", title: "Internet Safety Policy Requirement",
                  intro: "Schools must adopt and enforce a formal Internet Safety Policy.",
                  blocks: [
                    { label: "Legal Requirement", cite: "47 U.S.C. §254(h)(5)(A)", desc: "Requires schools with E-Rate-funded internet access to certify that an Internet Safety Policy has been adopted and implemented." },
                    { label: "Policy Topics (Statute)", cite: "47 U.S.C. §254(l)", desc: "Specifies the required topics an Internet Safety Policy must address." },
                    { label: "Regulatory Implementation", cite: "47 CFR §54.520(c)(1)(i)", desc: "Requires a written Internet Safety Policy as part of E-Rate certification." },
                  ],
                  list: { label: "The Internet Safety Policy must address:", items: [
                    "Access by minors to inappropriate matter on the internet",
                    "Safety and security when using electronic mail, chat rooms, and direct electronic communications",
                    "Unauthorized access (hacking) and other unlawful online activities",
                    "Unauthorized disclosure, use, or dissemination of personal information about minors",
                    "Measures restricting minors' access to materials harmful to minors",
                  ]}
                },
                {
                  num: "3", title: "Monitoring Online Activities of Minors",
                  intro: "Schools must monitor the online activities of minors using school internet systems.",
                  blocks: [
                    { label: "Legal Requirement", cite: "47 U.S.C. §254(h)(5)(B)", desc: "Requires schools to enforce policies that include monitoring the online activities of minors." },
                    { label: "Regulatory Implementation", cite: "47 CFR §54.520(c)(1)(i)", desc: "The Internet Safety Policy must include monitoring of internet usage by minors as an enforceable component." },
                  ],
                  note: "🔍 Monitoring requirements support the use of tools like GoGuardian, LanSchool, and Classwize on school networks."
                },
                {
                  num: "4", title: "Online Safety Education",
                  intro: "Added by the Protecting Children in the 21st Century Act, schools must educate students about online behavior and digital safety.",
                  blocks: [
                    { label: "Legal Requirement", cite: "47 U.S.C. §254(h)(5)(B)(iii)", desc: "Requires schools' Internet Safety Policies to provide for educating minors about appropriate online behavior, including on social networks, and about cyberbullying." },
                    { label: "Regulatory Implementation", cite: "47 CFR §54.520(c)(1)(i)(B)", desc: "Schools' Internet Safety Policies must include education on social networking safety, chat rooms, and cyberbullying awareness and response. Effective July 1, 2012." },
                  ],
                  list: { label: "Education must cover:", items: [
                    "Appropriate online behavior",
                    "Interacting with others on social networking sites",
                    "Chat room safety",
                    "Cyberbullying awareness and response",
                  ]},
                  note: "🎓 This is the legal basis for digital citizenship curricula and lessons in K-12 schools."
                },
                {
                  num: "5", title: "Public Notice and Hearing Requirement",
                  intro: "Before adopting an Internet Safety Policy, schools must provide public notice and hold a hearing or meeting.",
                  blocks: [
                    { label: "Legal Requirement", cite: "47 U.S.C. §254(h)(5)(A)(iii)", desc: "Requires schools to provide reasonable public notice and hold at least one public meeting or hearing before adopting their Internet Safety Policy." },
                    { label: "Regulatory Implementation", cite: "47 CFR §54.520(c)(1)", desc: "Schools must certify compliance with the public notice and hearing process when applying for E-Rate funding on FCC Form 486." },
                  ],
                  list: { label: "Required process:", items: [
                    "Provide reasonable public notice of the proposed Internet Safety Policy",
                    "Hold at least one public meeting or hearing on the policy",
                    "Certify completion of this process on FCC Form 486",
                  ]}
                },
                {
                  num: "6", title: "Filter Disabling for Adults",
                  intro: "CIPA allows schools and libraries to disable filters for adults conducting legitimate research or other lawful purposes.",
                  blocks: [
                    { label: "Legal Requirement — Schools", cite: "47 U.S.C. §254(h)(5)(D)", desc: "Permits an authorized administrator or supervisor to disable the technology protection measure for an adult user to enable access for bona fide research or other lawful purpose." },
                    { label: "Legal Requirement — Libraries", cite: "47 U.S.C. §254(h)(6)(D)", desc: "Applies the same disabling allowance to library administrators for adult patrons." },
                  ],
                  list: { label: "Filters may be disabled when:", items: [
                    "The user is an adult (not a minor)",
                    "The purpose is bona fide research",
                    "The purpose is another lawful activity",
                    "An authorized administrator or supervisor approves the override",
                  ]},
                  note: "⚠️ Filters may only be disabled for adults — they must remain active for all minor users."
                },
              ].map(section => (
                <div key={section.num} style={{ marginBottom: 32 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                    <div style={{ width: 32, height: 32, background: "#064e3b", color: "white", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 15, flexShrink: 0 }}>{section.num}</div>
                    <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#064e3b" }}>{section.title}</h3>
                  </div>
                  {section.intro && <p style={{ margin: "0 0 14px 44px", fontSize: 13, color: "#3c3529", lineHeight: 1.7 }}>{section.intro}</p>}

                  {section.blocks?.map((b, i) => (
                    <div key={i} style={{ marginLeft: 44, marginBottom: 10, padding: "10px 14px", background: "#f0fdf4", borderRadius: 10, borderLeft: "3px solid #059669" }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: "#059669", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 3 }}>{b.label}</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#064e3b", marginBottom: 4, fontFamily: "monospace" }}>{b.cite}</div>
                      <div style={{ fontSize: 13, color: "#5c5044", lineHeight: 1.6 }}>{b.desc}</div>
                    </div>
                  ))}

                  {section.list && (
                    <div style={{ marginLeft: 44, marginBottom: section.note ? 10 : 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#7c6f5e", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>{section.list.label}</div>
                      <ul style={{ margin: 0, paddingLeft: 18 }}>
                        {section.list.items.map(item => <li key={item} style={{ fontSize: 13, color: "#3c3529", lineHeight: 1.8 }}>{item}</li>)}
                      </ul>
                    </div>
                  )}

                  {section.note && (
                    <div style={{ marginLeft: 44, marginTop: 10, padding: "9px 14px", background: "#fef3c7", borderRadius: 8, border: "1px solid #fcd34d", fontSize: 13, color: "#92400e", lineHeight: 1.6 }}>
                      {section.note}
                    </div>
                  )}
                </div>
              ))}

              {/* Quick Legal Map */}
              <div style={{ borderTop: "2px solid #e2ddd5", paddingTop: 24, marginTop: 8 }}>
                <h3 style={{ margin: "0 0 14px", fontSize: 16, fontWeight: 800, color: "#064e3b" }}>📌 Quick CIPA Legal Map</h3>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "#064e3b" }}>
                      <th style={{ padding: "9px 14px", color: "white", textAlign: "left", fontWeight: 700 }}>CIPA Protection</th>
                      <th style={{ padding: "9px 14px", color: "white", textAlign: "left", fontWeight: 700 }}>Legal Citation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["Filtering harmful content", "47 U.S.C. §254(h)(5)(B)"],
                      ["Technology protection measures", "47 CFR §54.520(c)"],
                      ["Internet Safety Policy requirement", "47 U.S.C. §254(h)(5)(A)"],
                      ["ISP required topics", "47 U.S.C. §254(l)"],
                      ["Monitoring student online activity", "47 U.S.C. §254(h)(5)(B)"],
                      ["Digital citizenship education", "47 U.S.C. §254(h)(5)(B)(iii)"],
                      ["Public hearing requirement", "47 U.S.C. §254(h)(5)(A)(iii)"],
                      ["Disabling filters for adults", "47 U.S.C. §254(h)(5)(D)"],
                    ].map(([prot, cite], i) => (
                      <tr key={i} style={{ background: i % 2 === 0 ? "#f7f5f1" : "white" }}>
                        <td style={{ padding: "9px 14px", color: "#3c3529", borderBottom: "1px solid #e2ddd5" }}>{prot}</td>
                        <td style={{ padding: "9px 14px", fontFamily: "monospace", color: "#059669", fontWeight: 700, borderBottom: "1px solid #e2ddd5" }}>{cite}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Disclaimer */}
              <div style={{ marginTop: 24, padding: "12px 16px", background: "#fef3c7", borderRadius: 10, border: "1px solid #fcd34d", fontSize: 12, color: "#92400e", lineHeight: 1.7 }}>
                <strong>Disclaimer:</strong> This reference guide is provided for informational purposes only and reflects CIPA as codified in 47 U.S.C. §254(h) and (l) and implemented via 47 CFR §54.520 (FCC rules). For legal advice specific to your district's compliance obligations, consult your district's legal counsel or the FCC's E-Rate resources at <strong>fcc.gov/consumers/guides/childrens-internet-protection-act</strong>.
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: "16px 36px", borderTop: "1px solid #e2ddd5", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#faf8f5" }}>
              <span style={{ fontSize: 12, color: "#9c8e81" }}>Source: 47 U.S.C. §254(h) &amp; (l) &amp; 47 CFR §54.520 — Current as of 2025</span>
              <button onClick={() => setShowCipa(false)} style={{ padding: "9px 24px", background: "#064e3b", color: "white", border: "none", borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>Close</button>
            </div>
          </div>
        </div>
      )}


      {/* ── COPPA MODAL ─────────────────────────────────────────────────────── */}
      {showCoppa && (
        <div onClick={() => setShowCoppa(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 9000, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "32px 16px", overflowY: "auto" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "white", borderRadius: 20, maxWidth: 860, width: "100%", boxShadow: "0 24px 80px rgba(0,0,0,0.25)", overflow: "hidden" }}>

            {/* Header */}
            <div style={{ background: "linear-gradient(135deg, #4c1d95 0%, #7c3aed 100%)", padding: "28px 36px", display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#ddd6fe", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Federal Law Reference</div>
                <h2 style={{ margin: 0, color: "white", fontSize: 24, fontWeight: 800 }}>🛡️ COPPA Protections</h2>
                <p style={{ margin: "6px 0 0", color: "#ede9fe", fontSize: 13 }}>Children's Online Privacy Protection Act — 15 U.S.C. §§6501–6505 &amp; 16 CFR Part 312</p>
              </div>
              <button onClick={() => setShowCoppa(false)} style={{ background: "rgba(255,255,255,0.15)", border: "none", color: "white", fontSize: 20, width: 36, height: 36, borderRadius: "50%", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>✕</button>
            </div>

            {/* Body */}
            <div style={{ padding: "32px 36px", maxHeight: "72vh", overflowY: "auto" }}>

              {[
                {
                  num: "1", title: "Protection of Children Under Age 13",
                  intro: "COPPA specifically protects children under the age of 13 when using online services.",
                  blocks: [
                    { label: "Legal Definition", cite: "15 U.S.C. §6501(1)", desc: "Defines a \"child\" as an individual under the age of 13." },
                    { label: "Regulatory Reference", cite: "16 CFR §312.2", desc: "Defines \"child,\" \"operator,\" and \"website or online service\" for purposes of the COPPA Rule." },
                  ],
                  list: { label: "COPPA applies to:", items: ["Websites directed to children", "Online services directed to children", "Online services that knowingly collect personal information from children under 13"] }
                },
                {
                  num: "2", title: "Personally Identifiable Information (PII) Collected from Children",
                  intro: "COPPA regulates the collection of personal information from children.",
                  blocks: [
                    { label: "Legal Reference", cite: "15 U.S.C. §6502(a)(1)", desc: "Establishes requirements for operators collecting personal information from children online." },
                    { label: "Regulatory Definition", cite: "16 CFR §312.2", desc: "Defines \"personal information\" broadly to include identifiers that can contact or locate a specific child." },
                  ],
                  list: { label: "Personal information includes:", items: [
                    "Full name",
                    "Home or physical address",
                    "Email address",
                    "Phone number",
                    "Screen name or username if it identifies the child",
                    "Persistent identifiers (cookies, device IDs, IP addresses)",
                    "Photos, videos, or audio files containing a child's image or voice",
                    "Geolocation information",
                    "Any combination of information that identifies a child",
                  ]},
                  note: "⚠️ The persistent identifier clause is particularly important for ed-tech and analytics tools."
                },
                {
                  num: "3", title: "Parental Notice and Transparency Requirements",
                  intro: "Operators must provide clear privacy notices about their data practices.",
                  blocks: [
                    { label: "Legal Requirement", cite: "15 U.S.C. §6502(b)(1)(A)", desc: "Requires operators to provide clear and prominent notice of information collection and use practices." },
                    { label: "Online Notice", cite: "16 CFR §312.4", desc: "Requires a privacy notice posted on the website or online service detailing the operator's information practices." },
                    { label: "Direct Notice to Parents", cite: "16 CFR §312.3", desc: "Requires operators to provide direct notice to parents before collecting personal information from a child." },
                  ],
                  list: { label: "Required disclosures include:", items: [
                    "What information is collected",
                    "How the information is used",
                    "Whether information is shared with third parties",
                    "How parents can control their child's data",
                  ]}
                },
                {
                  num: "4", title: "Verifiable Parental Consent",
                  intro: "Before collecting personal information from a child, operators must obtain verifiable parental consent.",
                  blocks: [
                    { label: "Legal Requirement", cite: "15 U.S.C. §6502(b)(1)(A)(ii)", desc: "Requires operators to obtain verifiable parental consent prior to collecting, using, or disclosing personal information from children." },
                    { label: "Regulatory Requirements", cite: "16 CFR §312.5", desc: "Specifies approved methods for obtaining and documenting verifiable parental consent." },
                  ],
                  list: { label: "Approved consent methods may include:", items: [
                    "Signed consent forms",
                    "Credit card verification",
                    "Government ID verification",
                    "Video calls",
                    "Knowledge-based authentication",
                  ]},
                  note: "🏫 Schools may provide consent on behalf of parents for educational technology used in the classroom, subject to certain conditions."
                },
                {
                  num: "5", title: "Parent Rights Over Their Child's Data",
                  intro: "Parents have rights similar to FERPA, but applied to online services.",
                  blocks: [
                    { label: "Legal Basis", cite: "15 U.S.C. §6502(b)(1)(B)", desc: "Grants parents the right to review and request deletion of their child's personal information held by operators." },
                    { label: "Regulatory Implementation", cite: "16 CFR §312.6", desc: "Specifies the right of a parent to review personal information collected from their child." },
                  ],
                  list: { label: "Parents have the right to:", items: [
                    "Review their child's personal information collected by the operator",
                    "Request deletion of their child's information",
                    "Refuse further collection or use of the information",
                  ]}
                },
                {
                  num: "6", title: "Data Security and Data Minimization",
                  intro: "Operators must take reasonable steps to protect the information they collect from children.",
                  blocks: [
                    { label: "Legal Requirement", cite: "15 U.S.C. §6502(b)(1)(D)", desc: "Requires operators to maintain the confidentiality, security, and integrity of personal information collected from children." },
                    { label: "Regulatory Implementation", cite: "16 CFR §312.8", desc: "Requires operators to establish and maintain reasonable procedures to protect the confidentiality, security, and integrity of personal information." },
                  ],
                  list: { label: "Operators must:", items: [
                    "Implement reasonable security procedures and practices",
                    "Protect against unauthorized access to or use of the information",
                    "Limit retention of children's data to only what is necessary",
                  ]}
                },
                {
                  num: "7", title: "Limits on Data Retention",
                  intro: "Children's personal information cannot be kept longer than necessary for the purpose for which it was collected.",
                  blocks: [
                    { label: "Regulatory Requirement", cite: "16 CFR §312.10", desc: "Operators must retain personal information collected from children only as long as reasonably necessary, then securely delete it." },
                  ],
                  list: { label: "Operators must:", items: [
                    "Retain children's data only as long as necessary to fulfill the specific collection purpose",
                    "Securely delete information when it is no longer needed",
                    "Not retain children's personal information indefinitely",
                  ]}
                },
              ].map(section => (
                <div key={section.num} style={{ marginBottom: 32 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                    <div style={{ width: 32, height: 32, background: "#4c1d95", color: "white", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 15, flexShrink: 0 }}>{section.num}</div>
                    <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#4c1d95" }}>{section.title}</h3>
                  </div>
                  {section.intro && <p style={{ margin: "0 0 14px 44px", fontSize: 13, color: "#3c3529", lineHeight: 1.7 }}>{section.intro}</p>}

                  {section.blocks?.map((b, i) => (
                    <div key={i} style={{ marginLeft: 44, marginBottom: 10, padding: "10px 14px", background: "#f5f3ff", borderRadius: 10, borderLeft: "3px solid #7c3aed" }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: "#7c3aed", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 3 }}>{b.label}</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#4c1d95", marginBottom: 4, fontFamily: "monospace" }}>{b.cite}</div>
                      <div style={{ fontSize: 13, color: "#5c5044", lineHeight: 1.6 }}>{b.desc}</div>
                    </div>
                  ))}

                  {section.list && (
                    <div style={{ marginLeft: 44, marginBottom: section.note ? 10 : 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#7c6f5e", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>{section.list.label}</div>
                      <ul style={{ margin: 0, paddingLeft: 18 }}>
                        {section.list.items.map(item => <li key={item} style={{ fontSize: 13, color: "#3c3529", lineHeight: 1.8 }}>{item}</li>)}
                      </ul>
                    </div>
                  )}

                  {section.note && (
                    <div style={{ marginLeft: 44, marginTop: 10, padding: "9px 14px", background: "#fef3c7", borderRadius: 8, border: "1px solid #fcd34d", fontSize: 13, color: "#92400e", lineHeight: 1.6 }}>
                      {section.note}
                    </div>
                  )}
                </div>
              ))}

              {/* Quick Legal Map */}
              <div style={{ borderTop: "2px solid #e2ddd5", paddingTop: 24, marginTop: 8 }}>
                <h3 style={{ margin: "0 0 14px", fontSize: 16, fontWeight: 800, color: "#4c1d95" }}>📌 Quick COPPA Legal Map</h3>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "#4c1d95" }}>
                      <th style={{ padding: "9px 14px", color: "white", textAlign: "left", fontWeight: 700 }}>COPPA Protection</th>
                      <th style={{ padding: "9px 14px", color: "white", textAlign: "left", fontWeight: 700 }}>Legal Citation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["Definition of child (under 13)", "15 U.S.C. §6501(1)"],
                      ["Personal information definition", "16 CFR §312.2"],
                      ["Privacy policy disclosure", "15 U.S.C. §6502(b)(1)(A)"],
                      ["Direct notice to parents", "16 CFR §312.3"],
                      ["Parental consent requirement", "16 CFR §312.5"],
                      ["Parent access & deletion rights", "16 CFR §312.6"],
                      ["Security requirements", "16 CFR §312.8"],
                      ["Data retention limits", "16 CFR §312.10"],
                    ].map(([prot, cite], i) => (
                      <tr key={i} style={{ background: i % 2 === 0 ? "#f7f5f1" : "white" }}>
                        <td style={{ padding: "9px 14px", color: "#3c3529", borderBottom: "1px solid #e2ddd5" }}>{prot}</td>
                        <td style={{ padding: "9px 14px", fontFamily: "monospace", color: "#7c3aed", fontWeight: 700, borderBottom: "1px solid #e2ddd5" }}>{cite}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Disclaimer */}
              <div style={{ marginTop: 24, padding: "12px 16px", background: "#fef3c7", borderRadius: 10, border: "1px solid #fcd34d", fontSize: 12, color: "#92400e", lineHeight: 1.7 }}>
                <strong>Disclaimer:</strong> This reference guide is provided for informational purposes only and reflects COPPA as codified in 15 U.S.C. §§6501–6505 and implemented via 16 CFR Part 312 (FTC COPPA Rule). For legal advice specific to your situation, consult your district's legal counsel or the FTC's COPPA resources at <strong>ftc.gov/coppa</strong>.
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: "16px 36px", borderTop: "1px solid #e2ddd5", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#faf8f5" }}>
              <span style={{ fontSize: 12, color: "#9c8e81" }}>Source: 15 U.S.C. §§6501–6505 &amp; 16 CFR Part 312 — Current as of 2025</span>
              <button onClick={() => setShowCoppa(false)} style={{ padding: "9px 24px", background: "#4c1d95", color: "white", border: "none", borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>Close</button>
            </div>
          </div>
        </div>
      )}


      {/* ── FERPA MODAL ─────────────────────────────────────────────────────── */}
      {showFerpa && (
        <div onClick={() => setShowFerpa(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 9000, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "32px 16px", overflowY: "auto" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "white", borderRadius: 20, maxWidth: 860, width: "100%", boxShadow: "0 24px 80px rgba(0,0,0,0.25)", overflow: "hidden" }}>

            {/* Header */}
            <div style={{ background: "linear-gradient(135deg, #1c3557 0%, #2d5a8e 100%)", padding: "28px 36px", display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#93c5fd", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Federal Law Reference</div>
                <h2 style={{ margin: 0, color: "white", fontSize: 24, fontWeight: 800 }}>⚖️ FERPA Protections</h2>
                <p style={{ margin: "6px 0 0", color: "#bfdbfe", fontSize: 13 }}>Family Educational Rights and Privacy Act — 20 U.S.C. §1232g &amp; 34 CFR Part 99</p>
              </div>
              <button onClick={() => setShowFerpa(false)} style={{ background: "rgba(255,255,255,0.15)", border: "none", color: "white", fontSize: 20, width: 36, height: 36, borderRadius: "50%", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>✕</button>
            </div>

            {/* Body */}
            <div style={{ padding: "32px 36px", maxHeight: "72vh", overflowY: "auto" }}>

              {/* Section helper */}
              {[
                {
                  num: "1", title: "Student Education Records",
                  intro: "FERPA protects education records maintained by schools.",
                  blocks: [
                    { label: "Legal Definition", cite: "20 U.S.C. §1232g(a)(4)(A)", desc: "Defines education records as records that contain information directly related to a student and are maintained by an educational agency or institution." },
                    { label: "Regulatory Definition", cite: "34 CFR §99.3", desc: "Further defines Education Records under federal regulation." },
                  ],
                  list: { label: "Examples protected under these sections:", items: ["Grades and transcripts","Report cards","Disciplinary records","Class schedules","Financial aid records","Special education documentation"] }
                },
                {
                  num: "2", title: "Personally Identifiable Information (PII)",
                  intro: "FERPA protects personally identifiable information contained in education records.",
                  blocks: [
                    { label: "Legal Reference", cite: "20 U.S.C. §1232g(b)(1)", desc: "Prohibits disclosure of education records or PII without written consent." },
                    { label: "Regulatory Definition", cite: "34 CFR §99.3", desc: "Defines Personally Identifiable Information (PII)." },
                  ],
                  list: { label: "PII includes:", items: ["Student name","Parent or family member names","Address","Personal identifiers (SSN, student ID number)","Indirect identifiers (date of birth, place of birth)","Biometric identifiers","Any combination of information that could identify the student"] }
                },
                {
                  num: "3", title: "Parent and Eligible Student Rights",
                  intro: "FERPA grants parents and eligible students specific rights.",
                  subSections: [
                    { title: "Right to Inspect and Review Records", cites: ["20 U.S.C. §1232g(a)(1)(A)", "34 CFR §99.10"], note: "Schools must allow access to records within 45 days of request." },
                    { title: "Right to Request Amendment of Records", cites: ["20 U.S.C. §1232g(a)(2)", "34 CFR §99.20 – §99.22"], note: "Applies when records are inaccurate or misleading. Includes the right to a formal hearing if the school denies the amendment request." },
                    { title: "Transfer of Rights at Age 18", cites: ["20 U.S.C. §1232g(d)", "34 CFR §99.5"], note: "When a student becomes an eligible student, rights transfer from parents to the student." },
                  ]
                },
                {
                  num: "4", title: "Control Over Disclosure of Records",
                  intro: "Schools generally must obtain written consent before disclosure.",
                  blocks: [
                    { label: "Core Rule", cite: "20 U.S.C. §1232g(b)(1) / 34 CFR §99.30", desc: "Requires written consent specifying: records disclosed, purpose of disclosure, and recipient of the information." },
                  ],
                  exceptions: [
                    { exception: "School officials with legitimate educational interest", cite: "34 CFR §99.31(a)(1)" },
                    { exception: "Transfer to another school", cite: "34 CFR §99.31(a)(2)" },
                    { exception: "Financial aid purposes", cite: "34 CFR §99.31(a)(4)" },
                    { exception: "Organizations conducting studies", cite: "34 CFR §99.31(a)(6)" },
                    { exception: "Accrediting organizations", cite: "34 CFR §99.31(a)(7)" },
                    { exception: "Judicial order or subpoena", cite: "34 CFR §99.31(a)(9)" },
                    { exception: "Health or safety emergency", cite: "34 CFR §99.31(a)(10)" },
                    { exception: "State and federal education authorities", cite: "34 CFR §99.31(a)(3)" },
                  ]
                },
                {
                  num: "5", title: "Directory Information",
                  intro: "FERPA allows schools to designate certain information as directory information, which may be disclosed without consent.",
                  blocks: [
                    { label: "Legal Basis", cite: "20 U.S.C. §1232g(a)(5) / 34 CFR §99.37", desc: "Schools must (1) provide annual notice to parents and students and (2) allow them to opt out." },
                  ],
                  list: { label: "Examples of directory information:", items: ["Student name","Address","Phone number","Email address","Photograph","Participation in sports","Degrees or awards received","Dates of attendance"] }
                }
              ].map(section => (
                <div key={section.num} style={{ marginBottom: 32 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                    <div style={{ width: 32, height: 32, background: "#1c3557", color: "white", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 15, flexShrink: 0 }}>{section.num}</div>
                    <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#1c3557" }}>{section.title}</h3>
                  </div>
                  {section.intro && <p style={{ margin: "0 0 14px 44px", fontSize: 13, color: "#3c3529", lineHeight: 1.7 }}>{section.intro}</p>}

                  {/* Citation blocks */}
                  {section.blocks?.map((b, i) => (
                    <div key={i} style={{ marginLeft: 44, marginBottom: 10, padding: "10px 14px", background: "#f0f4fb", borderRadius: 10, borderLeft: "3px solid #3b6fba" }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: "#3b6fba", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 3 }}>{b.label}</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#1c3557", marginBottom: 4, fontFamily: "monospace" }}>{b.cite}</div>
                      <div style={{ fontSize: 13, color: "#5c5044", lineHeight: 1.6 }}>{b.desc}</div>
                    </div>
                  ))}

                  {/* Sub-sections (section 3) */}
                  {section.subSections?.map((s, i) => (
                    <div key={i} style={{ marginLeft: 44, marginBottom: 14 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#1c3557", marginBottom: 6 }}>{s.title}</div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
                        {s.cites.map(c => <span key={c} style={{ fontSize: 12, fontFamily: "monospace", background: "#e0f2fe", color: "#0369a1", padding: "2px 8px", borderRadius: 6, fontWeight: 700 }}>{c}</span>)}
                      </div>
                      <p style={{ margin: 0, fontSize: 13, color: "#5c5044", lineHeight: 1.6 }}>{s.note}</p>
                    </div>
                  ))}

                  {/* Bullet list */}
                  {section.list && (
                    <div style={{ marginLeft: 44 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#7c6f5e", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>{section.list.label}</div>
                      <ul style={{ margin: 0, paddingLeft: 18 }}>
                        {section.list.items.map(item => <li key={item} style={{ fontSize: 13, color: "#3c3529", lineHeight: 1.8 }}>{item}</li>)}
                      </ul>
                    </div>
                  )}

                  {/* Exceptions table */}
                  {section.exceptions && (
                    <div style={{ marginLeft: 44 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#7c6f5e", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Key FERPA Exceptions — Disclosure Without Consent:</div>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                        <thead>
                          <tr style={{ background: "#1c3557" }}>
                            <th style={{ padding: "8px 12px", color: "white", textAlign: "left", fontWeight: 700, borderRadius: "6px 0 0 0" }}>Exception</th>
                            <th style={{ padding: "8px 12px", color: "white", textAlign: "left", fontWeight: 700, borderRadius: "0 6px 0 0" }}>FERPA Section</th>
                          </tr>
                        </thead>
                        <tbody>
                          {section.exceptions.map((ex, i) => (
                            <tr key={i} style={{ background: i % 2 === 0 ? "#f7f5f1" : "white" }}>
                              <td style={{ padding: "8px 12px", color: "#3c3529", borderBottom: "1px solid #e2ddd5" }}>{ex.exception}</td>
                              <td style={{ padding: "8px 12px", fontFamily: "monospace", color: "#0369a1", fontWeight: 700, borderBottom: "1px solid #e2ddd5" }}>{ex.cite}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}

              {/* Quick Legal Map */}
              <div style={{ borderTop: "2px solid #e2ddd5", paddingTop: 24, marginTop: 8 }}>
                <h3 style={{ margin: "0 0 14px", fontSize: 16, fontWeight: 800, color: "#1c3557" }}>📌 Quick FERPA Legal Map</h3>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "#1c3557" }}>
                      <th style={{ padding: "9px 14px", color: "white", textAlign: "left", fontWeight: 700 }}>FERPA Protection</th>
                      <th style={{ padding: "9px 14px", color: "white", textAlign: "left", fontWeight: 700 }}>Main Legal Citation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["Education records definition", "20 U.S.C. §1232g(a)(4) / 34 CFR §99.3"],
                      ["Protection of PII", "20 U.S.C. §1232g(b)(1)"],
                      ["Right to access records", "20 U.S.C. §1232g(a)(1)"],
                      ["Right to amend records", "20 U.S.C. §1232g(a)(2)"],
                      ["Transfer of rights at age 18", "20 U.S.C. §1232g(d)"],
                      ["Consent requirement", "34 CFR §99.30"],
                      ["Disclosure exceptions", "34 CFR §99.31"],
                      ["Directory information", "34 CFR §99.37"],
                    ].map(([prot, cite], i) => (
                      <tr key={i} style={{ background: i % 2 === 0 ? "#f7f5f1" : "white" }}>
                        <td style={{ padding: "9px 14px", color: "#3c3529", borderBottom: "1px solid #e2ddd5" }}>{prot}</td>
                        <td style={{ padding: "9px 14px", fontFamily: "monospace", color: "#0369a1", fontWeight: 700, borderBottom: "1px solid #e2ddd5" }}>{cite}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Footer disclaimer */}
              <div style={{ marginTop: 24, padding: "12px 16px", background: "#fef3c7", borderRadius: 10, border: "1px solid #fcd34d", fontSize: 12, color: "#92400e", lineHeight: 1.7 }}>
                <strong>Disclaimer:</strong> This reference guide is provided for informational purposes only and reflects the law as codified in 20 U.S.C. §1232g and 34 CFR Part 99. For legal advice specific to your situation, consult your district's legal counsel or the U.S. Department of Education's Student Privacy Policy Office at <strong>studentprivacy.ed.gov</strong>.
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: "16px 36px", borderTop: "1px solid #e2ddd5", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#faf8f5" }}>
              <span style={{ fontSize: 12, color: "#9c8e81" }}>Source: 20 U.S.C. §1232g &amp; 34 CFR Part 99 — Current as of 2025</span>
              <button onClick={() => setShowFerpa(false)} style={{ padding: "9px 24px", background: "#1c3557", color: "white", border: "none", borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>Close</button>
            </div>
          </div>
        </div>
      )}

      )}

      {/* ── Suggest a Tool Modal (Teacher) ─────────────────────────────── */}
      {showSuggestModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "white", borderRadius: 20, width: "100%", maxWidth: 520, boxShadow: "0 20px 60px rgba(0,0,0,0.25)", overflow: "hidden" }}>
            <div style={{ background: "linear-gradient(135deg, #7c3aed, #4f46e5)", padding: "22px 28px" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#c4b5fd", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Teacher · Suggest a Tool for Review</div>
              <h2 style={{ margin: 0, color: "white", fontSize: 18, fontWeight: 800 }}>💡 Suggest a Digital Tool</h2>
              <p style={{ margin: "6px 0 0", color: "#ddd6fe", fontSize: 13 }}>Our AI will instantly analyze the privacy policy and queue it for admin approval.</p>
            </div>
            <div style={{ padding: "24px 28px" }}>
              {suggestStatus === "loading" && (
                <div style={{ textAlign: "center", padding: "32px 0" }}>
                  <div style={{ fontSize: 32, marginBottom: 12 }}>🔍</div>
                  <div style={{ fontWeight: 700, color: "#4f46e5", marginBottom: 6 }}>Analyzing privacy policy…</div>
                  <div style={{ fontSize: 13, color: "#6b7280" }}>Claude is reviewing Terms of Service, Privacy Policy, and EULA for FERPA, COPPA &amp; CIPA compliance. This takes about 30 seconds.</div>
                </div>
              )}
              {suggestStatus && suggestStatus.success && (
                <div style={{ textAlign: "center", padding: "24px 0" }}>
                  <div style={{ fontSize: 36, marginBottom: 10 }}>✅</div>
                  <div style={{ fontWeight: 800, fontSize: 16, color: "#065f46", marginBottom: 8 }}>Submitted for Review!</div>
                  <div style={{ fontSize: 13, color: "#374151", marginBottom: 14, lineHeight: 1.6 }}>
                    <strong>{suggestStatus.name}</strong> has been analyzed and queued for admin review.
                    {suggestStatus.analysis?.riskLevel && <span> Initial risk rating: <strong style={{ color: suggestStatus.analysis.riskLevel === "High" ? "#dc2626" : suggestStatus.analysis.riskLevel === "Medium" ? "#d97706" : "#059669" }}>{suggestStatus.analysis.riskLevel}</strong>.</span>}
                  </div>
                  <div style={{ fontSize: 12, color: "#6b7280" }}>The district Technology Team will review and notify you of the decision.</div>
                </div>
              )}
              {suggestStatus && suggestStatus.error && (
                <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 10, padding: "14px 18px", marginBottom: 16, fontSize: 13, color: "#991b1b" }}>
                  ⚠️ {suggestStatus.error}
                </div>
              )}
              {!suggestStatus && (
                <>
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: .5, marginBottom: 5 }}>Tool / App Name *</label>
                    <input value={suggestName} onChange={e => setSuggestName(e.target.value)} placeholder="e.g. Canva for Education"
                      style={{ width: "100%", padding: "10px 12px", border: "1.5px solid #e5e7eb", borderRadius: 9, fontFamily: "inherit", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
                  </div>
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: .5, marginBottom: 5 }}>Website URL *</label>
                    <input value={suggestUrl} onChange={e => setSuggestUrl(e.target.value)} placeholder="https://www.example.com"
                      style={{ width: "100%", padding: "10px 12px", border: "1.5px solid #e5e7eb", borderRadius: 9, fontFamily: "inherit", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
                  </div>
                  <div style={{ marginBottom: 6 }}>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: .5, marginBottom: 5 }}>Why do you want to use it? (optional)</label>
                    <textarea value={suggestNote} onChange={e => setSuggestNote(e.target.value)} rows={2} placeholder="e.g. Great for creating infographics in my AP class"
                      style={{ width: "100%", padding: "10px 12px", border: "1.5px solid #e5e7eb", borderRadius: 9, fontFamily: "inherit", fontSize: 14, outline: "none", resize: "none", boxSizing: "border-box" }} />
                  </div>
                </>
              )}
            </div>
            <div style={{ padding: "14px 28px 22px", display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button onClick={() => setShowSuggestModal(false)} style={{ padding: "9px 20px", borderRadius: 9, border: "1.5px solid #e5e7eb", background: "white", color: "#374151", fontFamily: "inherit", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                {suggestStatus?.success ? "Close" : "Cancel"}
              </button>
              {!suggestStatus && (
                <button onClick={submitSuggestion} style={{ padding: "9px 22px", borderRadius: 9, border: "none", background: "linear-gradient(135deg, #7c3aed, #4f46e5)", color: "white", fontFamily: "inherit", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>
                  🚀 Submit for Analysis
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Admin Suggestions Panel (injected into admin view via portal-style overlay) ── */}
      {adminMode && view === "admin" && suggestionsLoaded && pendingSuggestions.length >= 0 && (
        <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 8000 }}>
          <button onClick={() => { setSuggestionsLoaded(false); loadSuggestions(); }}
            style={{ padding: "11px 20px", borderRadius: 30, background: pendingSuggestions.length > 0 ? "#7c3aed" : "#6b7280", color: "white", border: "none", fontFamily: "inherit", fontSize: 13, fontWeight: 800, cursor: "pointer", boxShadow: "0 4px 18px rgba(0,0,0,0.2)" }}>
            💡 {pendingSuggestions.length} Pending Suggestion{pendingSuggestions.length !== 1 ? "s" : ""}
          </button>
        </div>
      )}
    </div>
  );
}
