# Data sources, item by item

Generated from `src/data/*.json` on 15 Nov 2026; re-generate it whenever the data changes. Every number in the game is approximate and for learning.

**Summary:** 57 data items. **36 cite a NASA source**, 1 come from a physics formula, and 20 are **game estimates**: rounded values chosen for play, each saying what it is based on (often a manufacturer datasheet or a NASA example).

Main NASA references: CubeSat 101; NASA *State-of-the-Art of Small Spacecraft Technology* (SOA); the NASA GOES-R Series space segment overview; NASA pages for Landsat 9, Terra MODIS, NISAR, TROPICS and GOES-R.

Still estimates, and why: science instruments (the SOA report has no instrument chapter; values follow datasheets and real missions), rocket prices and capacities (generic classes, no real brands, by challenge rule), ground-station rental prices, and random-event odds.

## Buses

| Item | Source | What the numbers are based on |
|---|---|---|
| 3U CubeSat bus | NASA: CubeSat 101 | 1U is a 10 cm cube of about 1 to 1.33 kg, so 3U is at most about 4 kg. 3U is the most flown CubeSat size. |
| 6U CubeSat bus | NASA: CubeSat 101 | 1U is a 10 cm cube of about 1 to 1.33 kg, so 6U is at most about 8 kg. Build time: as little as 9 months, typically 18 to 24 months including parts. |
| 12U CubeSat bus | NASA: CubeSat 101 | CubeSat 101: 1U is a 10 cm cube of about 1 to 1.33 kg, and 12U is one of the larger common sizes. The 24 kg limit is a rounded estimate of what 12U deployers allow; price and build time are game estimates. |
| Small satellite bus | NASA: CubeSat 101 | CubeSat 101: a small satellite is under 300 kg. Cost and build time are rounded estimates. |
| Large satellite bus | Game estimate | Rounded from typical large Earth-observation and weather satellites. |

## Parts

| Item | Source | What the numbers are based on |
|---|---|---|
| Body solar cells | NASA: Small Spacecraft SOA | NASA State-of-the-Art of Small Spacecraft Technology (Power, Table 3-2): body-mounted 6U panels give about 17.6 to 19.2 W at peak. The game uses 12 W, an orbit average, because body cells only face the Sun part of the time. |
| Deployable solar wings | NASA: Small Spacecraft SOA | NASA State-of-the-Art of Small Spacecraft Technology (Power, Table 3-2): deployed 6U arrays give about 19.2 to 36 W at peak; the game uses 11 W as an orbit average. CubeSat 101 (ChargerSat-1): deployable panels nearly double the power, and with the body cells 12 W + 11 W = 23 W. |
| Large solar array | NASA: Small Spacecraft SOA | NASA State-of-the-Art of Small Spacecraft Technology (Power): flown space arrays cluster around 30 W/kg; this array is 300 W for 8 kg (about 37 W/kg). Price and build time are game estimates. |
| Small battery | NASA: Small Spacecraft SOA | NASA State-of-the-Art of Small Spacecraft Technology (Power, Table 3-5): CubeSat battery packs store about 91 to 178 Wh/kg; 8 Wh for 0.06 kg is about 133 Wh/kg. CubeSat 101: CubeSats use common lithium-ion cells with protection circuits. |
| Large battery | NASA: Small Spacecraft SOA | NASA State-of-the-Art of Small Spacecraft Technology (Power, Table 3-5): packs store about 91 to 178 Wh/kg; 40 Wh for 0.35 kg is about 114 Wh/kg. |
| Battery pack | NASA: Small Spacecraft SOA | NASA State-of-the-Art of Small Spacecraft Technology (Power, Table 3-5): packs store about 91 to 178 Wh/kg; 400 Wh for 3 kg is about 133 Wh/kg. Price is a game estimate. |
| Flight computer | NASA: Small Spacecraft SOA | NASA State-of-the-Art of Small Spacecraft Technology (Avionics, Table 8-4): CubeSat on-board computers draw about 0.2 to 6 W, and onboard memory is typically from hundreds of KB to several GB; the game uses 1.5 W and 4,000 MB. Price is a game estimate. |
| Magnetorquer | NASA: Small Spacecraft SOA | NASA State-of-the-Art of Small Spacecraft Technology (GNC, Table 5-4): CubeSat magnetorquers weigh about 0.017 to 0.205 kg and draw 0.38 to 0.77 W; the game uses a 3-axis board of 0.2 kg and 0.5 W. Price is a game estimate. |
| Reaction wheel | NASA: Small Spacecraft SOA | NASA State-of-the-Art of Small Spacecraft Technology (GNC, Table 5-3): CubeSat reaction wheels weigh about 0.05 to 0.75 kg and draw about 0.85 to 33 W at peak; the game uses 0.7 kg and 2 W average. Price is a game estimate. |
| Cold-gas thruster | NASA: Small Spacecraft SOA | NASA State-of-the-Art of Small Spacecraft Technology (In-Space Propulsion, Table 4-1): cold gas gives a specific impulse of 40 to 110 s; the game uses 65 s. 0.4 kg of the mass is propellant; delta-v uses the rocket equation. |
| UHF radio | NASA: CubeSat 101 | CubeSat 101: many CubeSats use amateur radio bands such as 437 MHz (70 cm). 9.6 kbps is a common CubeSat UHF speed. |
| S-band radio | NASA: Small Spacecraft SOA | NASA State-of-the-Art of Small Spacecraft Technology (Communications, Table 9-3): CubeSat S-band radios send about 0.125 to 4 Mbps; the game uses 1 Mbps. |
| X-band radio | NASA: Small Spacecraft SOA | NASA State-of-the-Art of Small Spacecraft Technology (Communications, Table 9-3): a 50 Mbps CubeSat X-band transmitter weighs about 130 g and transmits at 2 W; the game counts 3 W of input power. Price and build time are game estimates. |
| Camera | Game estimate | Rounded for a CubeSat visible-light camera. |
| Multispectral imager | Game estimate | Rounded for a CubeSat multispectral imager. |
| Thermal imager | Game estimate | Rounded for a CubeSat thermal infrared imager; long lead time. |
| Imaging radar | Game estimate | Rounded for a small-satellite synthetic aperture radar. |
| Spectrometer | Game estimate | Rounded for a CubeSat spectrometer. |
| Magnetometer | Game estimate | Rounded for a CubeSat magnetometer. |
| Star tracker | NASA: Small Spacecraft SOA | NASA State-of-the-Art of Small Spacecraft Technology (GNC, Table 5-5): small-spacecraft star trackers weigh about 0.04 to 0.5 kg and draw about 0.27 to 3 W; the game uses 0.15 kg and 0.7 W. Price and build time are game estimates. |
| GPS receiver | NASA: Small Spacecraft SOA | NASA State-of-the-Art of Small Spacecraft Technology (GNC, Table 5-10): small-spacecraft GPS receivers weigh about 0.002 to 0.4 kg and draw 0.01 to 3 W (NovAtel OEM719: 31 g, 0.9 W); the game uses 0.05 kg and 1.1 W. Price and build time are game estimates. |
| High-rate X-band radio | NASA: Small Spacecraft SOA | EnduroSat X-band transmitter: up to 150 Mbps, 396 g, about 12 W average. IQ spacecom XLink-X: up to 100 Mbps, 200 g, under 16 W. Price, build time and reliability are game estimates. NASA State-of-the-Art of Small Spacecraft Technology (Communications) lists CubeSat X-band transmitters from 50 Mbps up to several Gbps. |
| Mass-memory recorder | Game estimate | NASA SpaceCube Mini solid-state data recorder: a 1U card storing about 12 terabits at 5 to 7 W. The game gives it a smaller 256 GB. Mass, price and build time are game estimates. |
| Electric thruster (electrospray) | NASA: Small Spacecraft SOA | Busek 1U electrospray design: Isp 800 to 1600 s, about 2.5 W, over 350 m/s for a 1 kg CubeSat. Later electrospray systems: Isp above 1000 s at under 10 W. Mass, price and build time are game estimates. NASA State-of-the-Art of Small Spacecraft Technology (In-Space Propulsion, Table 4-1): electrospray thrusters give 225 to 3,000 s. |
| Green-propellant thruster | NASA: Small Spacecraft SOA | L3Harris MPS-130 1U module: 1.1 kg dry, 1.7 kg wet. NASA Lunar Flashlight (AF-M315E/ASCENT): mission-average Isp about 210 s. Price and build time are game estimates. NASA State-of-the-Art of Small Spacecraft Technology (In-Space Propulsion, Table 4-1): green monopropellants give 150 to 310 s. |
| Hyperspectral imager | Game estimate | Dragonfly Mantis: 0.5 kg, 4 to 6 W, 150 bands. Simera HyperScape100: 1.1 kg, 7 W imaging (flown on CogniSAT-6). Data per orbit, price and build time are game estimates. |
| AIS ship-tracking receiver | Game estimate | AAC SpaceQuest STS-300: 0.4 to 0.65 W. Alen Space AIS payload: under 135 g, 2.35 W peak. Flown on AAUSAT-3 (1U CubeSat). Price and build time are game estimates. |
| Weather imager | NASA: GOES-R overview | NASA GOES-R design overview (NTRS 20170009467): the GOES-R Advanced Baseline Imager takes a full Earth disk image every 15 minutes; NASA Earthdata: 16 spectral bands. Mass, power, data rate and price are game estimates. |
| Lightning mapper | NASA: GOES-R overview | NASA GOES-R design overview (NTRS 20170009467) and NASA Earthdata: the Geostationary Lightning Mapper is a high-speed camera at 777.4 nm that detects total lightning across the Western Hemisphere. Mass, power, data rate and price are game estimates. |
| Large solar wing | NASA: Small Spacecraft SOA | NASA State-of-the-Art of Small Spacecraft Technology (Power): flown space arrays cluster around 30 W/kg; this wing is 1,500 W for 50 kg. Price and build time are game estimates. |
| Battery bank | NASA: Small Spacecraft SOA | NASA State-of-the-Art of Small Spacecraft Technology (Power, Table 3-5): packs store about 91 to 178 Wh/kg; 2,000 Wh for 14 kg is about 143 Wh/kg. Price is a game estimate. |
| Hydrazine thrusters | NASA: Small Spacecraft SOA | NASA State-of-the-Art of Small Spacecraft Technology (In-Space Propulsion): hydrazine thrusters of 1 N and up give about 200 to 235 s; the game uses 220 s. NASA GOES-R design overview (NTRS 20170009467): the GOES-R fuel requirement is 15 years of storage and operations. 320 kg of the mass is propellant; price is a game estimate. |

## Rockets

| Item | Source | What the numbers are based on |
|---|---|---|
| Space Station deployment | NASA: CubeSat 101 | CubeSat 101 section 3.5: ISS deployment mission model. Price is a rounded estimate. |
| CubeSat rideshare | NASA: CubeSat 101 | CubeSat 101 chapter 3: CubeSats ride as secondary payloads in dispensers. Price is a rounded estimate. |
| Small rocket | Game estimate | Generic small launcher class; capacity and price rounded from public figures. |
| Medium rocket | Game estimate | Generic medium launcher class; capacity and price rounded from public figures. |
| Heavy rocket | Game estimate | Generic heavy launcher class; capacity and price rounded from public figures. |
| Super-heavy rocket | Game estimate | Generic super-heavy launcher class; capacity and price rounded from public figures. |

## Orbits

| Item | Source | What the numbers are based on |
|---|---|---|
| Space Station orbit | NASA: CubeSat 101 | CubeSat 101 section 3.5: CubeSats released from the Space Station share its orbit. Revisit is a rounded estimate. |
| Sun-synchronous orbit | Game estimate | Typical Earth-observation orbit. NASA: Landsat 9 flies a 705 km, 98.2 degree sun-synchronous orbit; the game offers 500 to 650 km for CubeSats. Revisit and sun angle are rounded estimates. |
| Geostationary orbit (GEO) | Physics formula | 35,786 km is the altitude where one orbit takes one day. |

## Ground stations

| Item | Source | What the numbers are based on |
|---|---|---|
| Amateur radio volunteers | NASA: CubeSat 101 | CubeSat 101 sections 2.10 and 2.16: the amateur radio community often helps contact CubeSats. Pass counts are rounded estimates. |
| Campus station (your own) | NASA: CubeSat 101 | CubeSat 101 section 2.10: teams build their own ground station; launching with an inadequate one is a mission killer. Pass counts are rounded estimates. |
| Polar station | Game estimate | High-latitude stations see polar orbits on most orbits; a 51.6 degree orbit never rises above the horizon there. Rounded rental price. |
| Commercial ground network | Game estimate | Rounded estimate for renting a worldwide ground network. For GEO the link is always on. |

## Scenarios

| Item | Source | What the numbers are based on |
|---|---|---|
| Wildfire Watch | NASA: CubeSat 101 | A 6U CubeSat mission. Build time from CubeSat 101 (typically 18 to 24 months); budget keeps CubeSat 101's advice of at least a 10% reserve. |
| Flood Radar | NASA: Design and Develop Science Missions | A user-segment-led mission (disaster agencies need maps within hours). Radar sees through clouds and at night. Budget and build time are game estimates sized for a small satellite with a radar. |
| Ship Watch | Game estimate | Based on real AIS CubeSats such as AAUSAT-3, which showed a 1U CubeSat with a simple dipole antenna can receive AIS from low Earth orbit. Budget, schedule and revisit are game estimates. |
| Storm Tracker | NASA: GOES-R overview | NASA GOES-R design overview: continuous imagery of the Western Hemisphere from geostationary orbit, a full Earth disk image every 15 minutes, Cloud and Moisture Imagery as the key requirement, data latency no longer than the refresh time, a 120 Mbps raw data downlink and a 15-year fuel requirement. Budget, schedule and lifetime are game estimates sized for one large satellite. |

## Random events

| Item | Source | What the numbers are based on |
|---|---|---|
| Solar storm | Game estimate | Space weather can damage solar cells and electronics; spacecraft often go into safe mode during storms. Chance and damage are game estimates. |
| Ground station outage | NASA: CubeSat 101 | CubeSat 101 section 2.10: the ground station is critical, so plan for it being unavailable. Outage length is a game estimate. |
| Radio not responding | Game estimate | Rebooting a stuck part is a common first fix in spacecraft operations. Chances are game estimates. |

Orbit decay table: Rounded typical lifetimes for a small craft with average solar activity. To check against GMAT runs; real decay changes a lot with the solar cycle.

Debris rule (25 years): CubeSat 101 section 6.1: an orbital debris report must show the craft will deorbit in a reasonable time. We use NASA's 25-year guideline; FCC-licensed craft now face a stricter 5-year rule.

## Real missions ("your design is most like…")

| Mission | Checked on | What was checked |
|---|---|---|
| Landsat 9 | https://science.nasa.gov/mission/landsat-9/ | NASA Science Landsat 9 pages: launch 27 Sep 2021, 705 km, 98.2 degree sun-synchronous orbit, OLI-2 and TIRS-2, 11 wavelengths, 8-day repeat with Landsat 8. |
| Terra (MODIS) | https://www.earthdata.nasa.gov/news/feature-articles/wildfires-cant-hide-from-earth-observing-satellites | NASA Earthdata and FIRMS pages: near-polar sun-synchronous orbit, about 10:30 local crossing, active fires found in thermal infrared (4 and 11 micrometre bands), 1 km pixels, fire data since November 2000. |
| NISAR | https://science.nasa.gov/mission/nisar/mission-overview/ | NASA NISAR mission overview and water pages: launch 30 Jul 2025, 747 km, 98.4 degree sun-synchronous orbit, 12-day repeat, L-band radar works through clouds day or night, tracks floods under vegetation. |
| TROPICS | https://www.nasa.gov/news-release/nasa-rocket-lab-complete-launch-of-tropics-cubesat-constellation/ | NASA news release and small-satellite blog: 3U CubeSats, four launched on two Rocket Lab launches in May 2023, microwave radiometer, median revisit about 60 minutes. |
| GOES-R series | https://www.nasa.gov/news-release/nasa-successfully-launches-noaa-advanced-geostationary-weather-satellite/ | NASA pages on GOES-R: four satellites (R, S, T, U), first launched November 2016, Advanced Baseline Imager with 16 spectral bands, run by an integrated NOAA-NASA office. |
