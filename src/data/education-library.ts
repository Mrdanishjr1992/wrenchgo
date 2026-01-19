export type EducationArticleSection = {
  title: string;
  content: string;
  icon?: string;
  highlight?: 'info' | 'warning' | 'danger' | 'success';
};

export type EducationArticle = {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  icon: string;
  iconBg: string;
  iconColor: string;
  category: 'troubleshooting' | 'maintenance' | 'safety' | 'general';
  urgencyLevel?: 'high' | 'medium' | 'low';
  readTimeMinutes: number;
  sections: EducationArticleSection[];
  ctaText?: string;
  ctaRoute?: string;
};

export const EDUCATION_ARTICLES: EducationArticle[] = [
  {
    id: 'car-wont-start',
    slug: 'car-wont-start',
    title: "Car Won't Start?",
    subtitle: 'Learn the common causes and what to do',
    icon: 'warning',
    iconBg: 'errorBg',
    iconColor: 'error',
    category: 'troubleshooting',
    urgencyLevel: 'high',
    readTimeMinutes: 4,
    sections: [
      {
        title: 'Common Causes',
        icon: '🔍',
        content: `When your car won't start, it's usually one of these issues:

• **Dead Battery** - The most common cause. You might hear clicking sounds or see dim dashboard lights.

• **Faulty Starter Motor** - You'll hear a single click or grinding noise when turning the key.

• **Alternator Problems** - If your battery keeps dying, the alternator may not be charging it properly.

• **Fuel System Issues** - Empty tank, clogged fuel filter, or failed fuel pump can prevent starting.

• **Ignition Switch Problems** - The car may not respond at all when you turn the key.`,
      },
      {
        title: 'What You Can Safely Check',
        icon: '✅',
        content: `Before calling for help, try these safe checks:

1. **Check the battery connections** - Look for corrosion (white/green buildup) on the terminals.

2. **Try the headlights** - If they're dim or won't turn on, it's likely a battery issue.

3. **Listen carefully** - The sound (or lack of sound) when you turn the key helps diagnose the problem.

4. **Check the fuel gauge** - Make sure you have fuel in the tank.

5. **Try a different key** - If you have a spare, the key fob battery might be dead.`,
        highlight: 'info',
      },
      {
        title: 'When You Need Roadside Help',
        icon: '🚨',
        highlight: 'warning',
        content: `You should call for professional help if:

• The car makes no sound at all when you turn the key
• You smell burning or see smoke
• You've tried jump-starting and it still won't start
• The engine cranks but won't turn over
• You're in an unsafe location

**Don't keep trying to start the car repeatedly** - this can drain the battery further or damage the starter.`,
      },
      {
        title: 'What to Expect from a Mechanic',
        icon: '🔧',
        content: `A mobile mechanic will typically:

1. **Diagnose the issue** - Using professional tools to identify the exact problem.

2. **Test the battery** - Check voltage and charging capacity.

3. **Inspect the starter and alternator** - Determine if replacement is needed.

4. **Provide options** - Give you a clear quote before any repairs.

Most no-start issues can be diagnosed and often fixed on-site within 1-2 hours.`,
      },
    ],
    ctaText: 'Request a Mechanic',
    ctaRoute: '/(customer)/new-job',
  },
  {
    id: 'check-engine-light',
    slug: 'check-engine-light',
    title: 'Check Engine Light On?',
    subtitle: 'Understand what it means and how serious it is',
    icon: 'speedometer',
    iconBg: 'warningBg',
    iconColor: 'warning',
    category: 'troubleshooting',
    urgencyLevel: 'medium',
    readTimeMinutes: 5,
    sections: [
      {
        title: 'What the Check Engine Light Means',
        icon: '💡',
        content: `The check engine light (CEL) indicates your car's computer has detected a problem with the engine, transmission, or emissions system.

**It doesn't mean your engine is about to explode** - but it does mean something needs attention.

The light can indicate hundreds of different issues, from minor (loose gas cap) to serious (catalytic converter failure).`,
      },
      {
        title: 'Solid vs. Flashing Light',
        icon: '⚠️',
        highlight: 'danger',
        content: `**SOLID LIGHT (Steady)**
Usually indicates a less urgent issue. You can typically continue driving short distances, but should get it checked soon.

**FLASHING LIGHT (Blinking)**
This is serious! A flashing check engine light usually means:
• Engine misfire
• Potential catalytic converter damage
• Risk of further engine damage

**If your light is flashing, reduce speed and get to a mechanic as soon as possible. Avoid hard acceleration.**`,
      },
      {
        title: 'Common Causes',
        icon: '🔍',
        content: `The most frequent check engine light triggers:

• **Loose or damaged gas cap** - Tighten it and see if the light goes off after a few drives.

• **Oxygen sensor failure** - Affects fuel efficiency and emissions.

• **Catalytic converter issues** - Often caused by ignoring other problems.

• **Mass airflow sensor** - Affects how your engine runs.

• **Spark plugs or ignition coils** - Can cause misfires and rough running.

• **EVAP system leak** - Related to fuel vapor recovery.`,
      },
      {
        title: 'Is It Safe to Drive?',
        icon: '🚗',
        highlight: 'warning',
        content: `**With a SOLID light:**
Generally safe for short trips, but avoid:
• Long highway drives
• Towing or heavy loads
• Ignoring it for more than a week

**With a FLASHING light:**
• Drive slowly and directly to a mechanic
• Avoid highways if possible
• Don't ignore it - serious damage can occur

**Other warning signs to watch for:**
• Unusual sounds or vibrations
• Loss of power
• Smoke from exhaust
• Strange smells`,
      },
      {
        title: 'What a Diagnostic Involves',
        icon: '🔧',
        content: `When you bring your car in for a check engine light:

1. **Code Reading** - A scanner reads the trouble codes stored in your car's computer.

2. **Code Interpretation** - The mechanic determines what the codes mean for your specific vehicle.

3. **Physical Inspection** - Visual and hands-on checks to confirm the diagnosis.

4. **Repair Estimate** - You'll get a clear quote before any work begins.

**Note:** The code tells us where to look, not always exactly what's wrong. A proper diagnosis may take 30-60 minutes.`,
      },
    ],
    ctaText: 'Get Diagnostic Help',
    ctaRoute: '/(customer)/new-job',
  },
  {
    id: 'regular-maintenance',
    slug: 'regular-maintenance',
    title: 'Regular Maintenance',
    subtitle: 'Keep your car running smoothly and save money',
    icon: 'build',
    iconBg: 'successBg',
    iconColor: 'success',
    category: 'maintenance',
    urgencyLevel: 'low',
    readTimeMinutes: 6,
    sections: [
      {
        title: 'Why Maintenance Matters',
        icon: '💰',
        content: `Regular maintenance isn't just about keeping your car running - it's about saving money.

**Preventive maintenance costs less than repairs:**
• Oil change: ~$50-80
• Engine replacement: $3,000-7,000+

**Benefits of staying on schedule:**
• Better fuel efficiency
• Longer vehicle life
• Higher resale value
• Fewer unexpected breakdowns
• Safer driving`,
      },
      {
        title: 'Oil Changes',
        icon: '🛢️',
        highlight: 'info',
        content: `**How often?**
• Conventional oil: Every 3,000-5,000 miles
• Synthetic oil: Every 7,500-10,000 miles
• Check your owner's manual for your car's specific needs

**Warning signs you're overdue:**
• Dark, gritty oil on the dipstick
• Engine running louder than usual
• Oil change light on dashboard
• Exhaust smoke

**What's included:**
• Drain old oil
• Replace oil filter
• Add fresh oil
• Check fluid levels
• Basic inspection`,
      },
      {
        title: 'Brake Service',
        icon: '🛑',
        highlight: 'warning',
        content: `**When to check brakes:**
• Every 12,000-15,000 miles for inspection
• Immediately if you notice warning signs

**Warning signs:**
• Squealing or grinding noise when braking
• Car pulls to one side when braking
• Brake pedal feels soft or spongy
• Vibration when braking
• Brake warning light on

**What brake service includes:**
• Pad inspection and replacement
• Rotor inspection (resurface or replace)
• Brake fluid check
• Caliper inspection`,
      },
      {
        title: 'Other Essential Services',
        icon: '📋',
        content: `**Tire Rotation** (Every 5,000-7,500 miles)
• Ensures even tire wear
• Extends tire life
• Improves handling

**Air Filter** (Every 15,000-30,000 miles)
• Improves fuel efficiency
• Protects engine from debris

**Coolant Flush** (Every 30,000 miles or 5 years)
• Prevents overheating
• Protects against corrosion

**Transmission Service** (Every 30,000-60,000 miles)
• Fluid change or flush
• Prevents costly transmission repairs

**Battery Check** (Every 3 years)
• Test charging capacity
• Clean terminals
• Replace before it fails`,
      },
      {
        title: 'Creating a Maintenance Schedule',
        icon: '📅',
        content: `**Easy way to stay on track:**

1. **Check your owner's manual** - It has the manufacturer's recommended schedule.

2. **Track your mileage** - Note when services are due.

3. **Set reminders** - Use your phone or calendar.

4. **Keep records** - Save receipts and service records.

**Quick reference:**
• Every 5,000 miles: Oil change, tire rotation
• Every 15,000 miles: Air filter, brake inspection
• Every 30,000 miles: Transmission, coolant
• Every 50,000 miles: Spark plugs, timing belt check`,
        highlight: 'success',
      },
    ],
    ctaText: 'View Maintenance Services',
    ctaRoute: '/(customer)/new-job',
  },
];

export function getArticleBySlug(slug: string): EducationArticle | undefined {
  return EDUCATION_ARTICLES.find((article) => article.slug === slug);
}

export function getArticlesByCategory(category: EducationArticle['category']): EducationArticle[] {
  return EDUCATION_ARTICLES.filter((article) => article.category === category);
}
