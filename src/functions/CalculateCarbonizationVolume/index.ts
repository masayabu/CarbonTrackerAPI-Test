import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";

// Constants for volume calculation for each device model
const DEVICE_CONSTANTS = {
  L500: {
    H: 44.0,   // height in cm
    R: 73.5,   // top radius in cm
    br: 48.0,  // bottom radius in cm
  },
  L180: {
    H: 34.5,   // height in cm
    R: 48.0,   // top radius in cm
    br: 28.0,  // bottom radius in cm
  },
  L40: {
    H: 22.0,   // height in cm
    R: 28.0,   // top radius in cm
    br: 15.5,  // bottom radius in cm
  },
} as const;

// Constants for calculations
const CHARCOAL_DENSITY = 0.11; // kg/L
const CARBON_CONTENT = 0.8;    // 80% of charcoal weight
const CO2_RATIO = 3.67;        // CO2/C ratio

// Input validation
interface CalculateVolumeInput {
  model: 'L500' | 'L180' | 'L40';
  height: number;
}

/**
 * Calculate radius and volume for given height and device model
 * @param h height in cm
 * @param model device model (L500, L180, L40)
 * @returns [tr (top radius), volume_l (volume in liters)]
 */
function volumeLiters(h: number, model: keyof typeof DEVICE_CONSTANTS): [number, number] {
  const constants = DEVICE_CONSTANTS[model];
  const { H, R, br } = constants;

  // Handle edge cases
  if (h <= 0) {
    return [0.0, 0.0];
  }
  if (h > H) {
    h = H;
  }

  // Calculate top radius (tr)
  const tr = br + (R - br) * (h / H);

  // Calculate volume in cm^3 and convert to liters
  const volumeL = (Math.PI * h / 3.0 * (tr * tr + tr * br + br * br)) / 1000.0;

  return [tr, volumeL];
}

async function calculateCarbonizationVolume(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const body = await request.json() as CalculateVolumeInput;
    
    // Basic validation
    if (!body.model || !['L500', 'L180', 'L40'].includes(body.model)) {
      return {
        status: 400,
        body: JSON.stringify({ error: 'Invalid model. Must be L500, L180, or L40' }),
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      };
    }
    
    if (!body.height || typeof body.height !== 'number' || body.height <= 0) {
      return {
        status: 400,
        body: JSON.stringify({ error: 'Invalid height. Must be a positive number' }),
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      };
    }

    const { model, height } = body;

    // Calculate volume using the new logic
    const [topRadius, volumeInLiters] = volumeLiters(height, model);

    // Calculate charcoal production and carbon sequestration
    const charcoalWeight = volumeInLiters * CHARCOAL_DENSITY;
    const carbonWeight = charcoalWeight * CARBON_CONTENT;
    const co2Sequestration = carbonWeight * CO2_RATIO;

    return {
      status: 200,
      body: JSON.stringify({
        model,
        height,
        topRadius,        // 上面半径 (cm)
        volumeLiters: volumeInLiters,     // 体積 (L)
        charcoalWeight,   // 製炭量 (kg)
        carbonWeight,     // 炭素量 (kg-C)
        co2Sequestration, // 炭素固定量 (kg-CO2)
      }),
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    };
  } catch (error) {
    context.error('Error calculating volume:', error);
    return {
      status: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    };
  }
}

app.http('CalculateCarbonizationVolume', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'production/calculate-volume',
  handler: calculateCarbonizationVolume,
});

export { calculateCarbonizationVolume as CalculateCarbonizationVolume };
