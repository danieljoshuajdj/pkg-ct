import chalk from 'chalk';

export const packageCountTemplates = [
  "Your project has {count} packages. At this point npm install is a lifestyle choice.",
  "{count} packages detected. Somewhere, a lockfile is asking for a chair and a glass of water.",
  "I counted {count} packages. That is not a dependency tree; that is a small bureaucracy.",
  "Your node_modules has {count} directories. Even the event loop is tired of waiting for your imports.",
  "With {count} packages, your hard drive is basically a retirement home for obsolete JS files.",
  "You have {count} packages. If dependencies were guests, your project would be a sold-out stadium.",
  "At {count} packages, you're not coding; you're coordinating an alliance of 200 developers you've never met.",
  "A whopping {count} dependencies. Your build pipeline is basically a Rube Goldberg machine.",
  "Your dependency graph has {count} nodes. A cartographer couldn't map this level of chaos.",
  "{count} packages. Somewhere, a developer is laughing at your disk space usage.",
  "At {count} packages, your node_modules directory could probably collapse into a black hole.",
  "{count} dependencies. It's like you asked npm for 'everything' and it delivered.",
  "I found {count} packages. You might want to buy your SSD a cup of coffee to apologize.",
  "With {count} dependencies, you are one typo away from executing a bitcoin miner in production.",
  "A nice, round {count} packages. Perfect for when you want your repository to double as a archive of the internet."
];

export const duplicateTemplates = [
  "{count} duplicate package family issue(s). The lockfile is doing jazz with no rhythm section.",
  "{count} duplicate family issue(s). Same package, multiple versions, maximum emotional distance.",
  "{count} duplicate family issue(s). Your dependencies brought their cousins, and nobody coordinated outfits.",
  "{count} duplicates. Why have one copy when you can have three at twice the memory cost?",
  "We found {count} duplicates. Your project is basically running its own version-conflict simulation.",
  "{count} version duplicates. That's a great way to ensure global state variables play hide and seek.",
  "Deduplication is not in your dictionary. {count} duplicates prove you like to hoard versions.",
  "{count} duplicates. Your build is literally shipping history classes of the same package.",
  "With {count} version overlaps, you are basically collecting packages like Pokémon cards.",
  "Your lockfile has {count} duplicated families. It's like a family reunion where nobody speaks to each other.",
  "We have {count} duplicates. Because resolving ranges is a task you'd rather delegate to future you.",
  "No two libraries are alike, but {count} of yours are literally the same library twice.",
  "{count} version clashes. Your bundle size is crying, but your lockfile remains unbothered.",
  "{count} duplicate packages. You've got version drift that could isolate an island chain.",
  "A solid {count} duplicate package issues. Just in case one version isn't buggy enough."
];

export const peerTemplates = [
  "{count} peer dependency issue(s). The ecosystem compatibility committee has failed to reach consensus.",
  "You have {count} peer conflicts. They are arguing about version ranges like old friends in a tavern.",
  "{count} peer dependency warning(s). They are not angry, just disappointed in your install command.",
  "With {count} peer issues, you are basically ignoring the warnings like they are terms and conditions.",
  "There are {count} peer mismatches. It's a miracle the package manager didn't just throw a syntax error and self-destruct.",
  "{count} peer range conflicts. Your dependencies want different versions of the same thing. Good luck with that.",
  "{count} peer dependency issues. It's like trying to host a dinner party where half the guests refuse to be in the same room.",
  "Your peer dependencies are mismatched ({count} issues). You are living on the edge of runtime exceptions.",
  "A total of {count} peer mismatches. Your dependency solver is basically guessing at this point.",
  "We got {count} peer dependency conflicts. Standard npm behavior, really, but still sad."
];

export const securityTemplates = [
  "{count} audit/security issue(s). Security has entered the chat and brought receipts.",
  "{count} security vulnerabilities. Your project has more entry points than a public park.",
  "We found {count} security issues. The firewall is basically just a suggestion at this point.",
  "With {count} vulnerabilities, your codebase is a theme park for script kiddies.",
  "{count} security risks surfaced. You're basically hosting a welcome party for CVEs.",
  "There are {count} security alerts. Don't worry, they are only critical if you run this on a computer that is connected to the internet.",
  "{count} security issues. Hackers wouldn't even need to bypass your security; they could just read the package list.",
  "A proud {count} security warnings. That's not a security posture; that's a security invitation.",
  "{count} vulnerable paths. Your dependency trees look like they were designed by the attackers themselves.",
  "{count} security findings. It's fine, I'm sure none of those transitive dependencies are malicious."
];

export const deprecatedTemplates = [
  "{count} deprecated package(s). Some of this dependency tree still thinks callbacks are the future.",
  "I see {count} deprecated packages. They belong in a museum, not in a package.json.",
  "Your build uses {count} deprecated packages. It's retro, in a way. Like floppy disks.",
  "{count} deprecated dependencies. The maintainers abandoned them years ago, but you're still holding on. Romantic.",
  "With {count} deprecated libraries, your code is basically running on virtual museum exhibits.",
  "There are {count} deprecated packages. They haven't been updated since the Obama administration.",
  "I found {count} deprecated packages. Even the warning messages have warning messages.",
  "Your lockfile has {count} deprecated nodes. They are basically software zombies at this point.",
  "{count} obsolete packages. They are stable, in the sense that they are dead.",
  "A classic {count} deprecated dependencies. Keeping legacy APIs alive single-handedly."
];

export const unusedTemplates = [
  "{count} direct package(s) look unused. They may be config-driven, or they may just be freeloading.",
  "{count} possible unused direct package(s). Some may be innocent. Some know what they did.",
  "{count} package(s) were not found in imports. pkg-ct is side-eyeing them, not convicting them.",
  "You have {count} unused packages. It's like buying a gym membership and never going.",
  "{count} packages have zero imports. They are basically just taking up space in your node_modules.",
  "We found {count} unused dependencies. Why are they here? Just to suffer?",
  "With {count} unused imports, you are basically paying rent for packages that don't do any work.",
  "{count} packages appear unused. They are just vibing in the lockfile, doing nothing.",
  "I counted {count} packages that seem entirely unused. Housekeeping is highly recommended.",
  "There are {count} unused packages. Your imports are clean, but your manifest is messy."
];

export const healthScoreTemplates = [
  "Health score: {score}/100. {verdict}",
  "Overall rating is {score}/100. {verdict}",
  "Your project health sits at {score}/100. {verdict}",
  "Calculated health is {score}/100. {verdict}"
];

export function roastVerdict(score: number): string {
  if (score >= 90) return 'Annoyingly healthy. I wanted drama and got responsible engineering.';
  if (score >= 75) return 'Mostly fine, with a few dependencies wearing suspicious fake mustaches.';
  if (score >= 60) return 'Stable enough to ship, chaotic enough to keep an eye on.';
  if (score >= 45) return 'Technically alive. Please do not ask the lockfile to run a marathon.';
  return 'This dependency tree needs an architect, a plan, and possibly a quiet afternoon.';
}

export function pickTemplate(templates: string[], seed: number): string {
  const index = Math.abs(seed) % templates.length;
  return templates[index]!;
}
