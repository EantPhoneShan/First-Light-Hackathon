/**
 * Space terms used in the game (F21). `short` is the tooltip; `long` is the Learn more page.
 * Plain English, ages 13+. Facts are general knowledge; keep numbers rounded.
 */
export interface GlossaryTerm {
  id: string
  term: string
  short: string
  long: string
}

export const glossary: GlossaryTerm[] = [
  {
    id: 'eclipse',
    term: 'Eclipse',
    short: "Time a spacecraft spends in Earth's shadow, with no sunlight for its solar panels.",
    long: "In low Earth orbit a spacecraft goes round Earth about every 90 to 100 minutes, and spends roughly a third of each orbit in Earth's shadow. With no sunlight, the solar panels make no power, so everything runs on the battery until the craft comes back into the Sun. If the battery is too small, the craft shuts down. This is one of the most common ways small satellites fail.",
  },
  {
    id: 'cubesat',
    term: 'CubeSat',
    short: 'A small, standard-sized satellite built from 10 cm cubes called units (U).',
    long: 'A 1U CubeSat is a 10 cm cube weighing about 1 kg. Bigger ones join units together: 3U, 6U and 12U are common. Because the size is standard, CubeSats can share a rocket with other satellites (a rideshare), which makes them cheap enough for universities, schools and small companies.',
  },
  {
    id: 'bus',
    term: 'Bus',
    short: 'The body of the spacecraft: the frame plus the systems that keep it alive.',
    long: 'Engineers split a spacecraft into the payload (the instruments that do the mission) and the bus (everything that supports them: structure, power, computer, radio, attitude control and propulsion). In this game the bus you pick decides how many slots you have.',
  },
  {
    id: 'payload',
    term: 'Payload',
    short: 'The instruments that do the actual mission, such as cameras or radars.',
    long: 'The payload is why the mission exists. For Wildfire Watch it is the camera or thermal imager. Every other part of the spacecraft is there to give the payload power, point it, store its data and send that data home.',
  },
  {
    id: 'sso',
    term: 'Sun-synchronous orbit',
    short: 'A near-polar orbit that passes over each place at the same local time every day.',
    long: 'A sun-synchronous orbit (SSO) is tilted so that it slowly turns once a year, keeping pace with Earth going round the Sun. The result is that the satellite crosses the equator at the same local time on every pass, so the lighting in its pictures is always similar. Most Earth-observation satellites use it.',
  },
  {
    id: 'downlink',
    term: 'Downlink',
    short: 'Sending data from the spacecraft down to a ground station.',
    long: 'A spacecraft can only send data while a ground station can see it, during a pass that lasts a few minutes in low orbit. How much it can send depends on the radio speed, the number of passes per day and how long each pass lasts. If the instruments make data faster than the downlink can send it, storage fills up and data is lost.',
  },
  {
    id: 'ground-station',
    term: 'Ground station',
    short: 'An antenna on Earth that talks to the spacecraft when it passes overhead.',
    long: 'Ground stations near the poles see polar-orbiting satellites on almost every orbit, so they get many passes a day. Stations near the equator see them less often. Missions often rent time on stations around the world to get data down faster.',
  },
  {
    id: 'delta-v',
    term: 'Delta-v',
    short: 'How much a spacecraft can change its speed with its own engine, in metres per second.',
    long: "Delta-v is the 'fuel budget' of a spacecraft. Even in orbit, thin air slowly drags a low satellite down, so it needs small pushes to stay up. At the end of the mission it should use some delta-v to lower its orbit and burn up in the atmosphere, so it does not become space debris.",
  },
  {
    id: 'deorbit',
    term: 'De-orbit',
    short: 'Bringing a spacecraft down to burn up in the atmosphere at the end of its mission.',
    long: 'Dead satellites left in orbit add to space debris, which can hit working spacecraft. Space agencies expect low-orbit satellites to come down within a few years of the end of their mission. Small ones can do it with a thruster, or by choosing an orbit low enough that air drag brings them down.',
  },
  {
    id: 'max-q',
    term: 'Max Q',
    short: 'The moment in a launch when air pressure on the rocket is highest.',
    long: 'As the rocket speeds up, the air pushes on it harder; as it climbs, the air gets thinner. Max Q is the point where these balance out at the highest pressure, usually about a minute after liftoff. Rockets often throttle down briefly to get through it safely.',
  },
  {
    id: 'fairing',
    term: 'Fairing',
    short: 'The nose cone that protects the spacecraft while the rocket climbs through the air.',
    long: 'The fairing keeps the spacecraft safe from wind and heat during the climb. Once the rocket is above most of the atmosphere, the fairing splits in two and falls away, because carrying its weight any further would waste fuel.',
  },
  {
    id: 'cml',
    term: 'Concept Maturity Level',
    short: "NASA JPL's scale for how far a mission idea has developed, from a rough idea to a ready design.",
    long: "NASA's Jet Propulsion Laboratory uses Concept Maturity Levels (CML) to describe how mature a mission concept is. CML 1 is a basic idea, CML 2 checks if it is feasible, CML 3 compares options in a trade study and CML 4 is a point design with one chosen option. First Light's phases follow these steps.",
  },
  {
    id: 'data-customer',
    term: 'Data customer',
    short: 'The people who will use what the mission collects, such as firefighters.',
    long: "Missions are built for someone. A wildfire satellite is only useful if firefighters get the images quickly enough to act. That is why the score counts how much data reaches the customer and how fast, not just whether the spacecraft survived.",
  },
]

export const termById = (id: string) => glossary.find((t) => t.id === id)
