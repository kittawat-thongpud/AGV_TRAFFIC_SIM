import { AGV, Node } from '../types';

export interface TrafficCheckResult {
    action: 'MOVE' | 'WAIT' | 'REPATH_HEAD_ON';
    conflictReason: string | null;
    avoidData: { type: 'edge', u: string, v: string } | null;
    blockerId: number | null;
}

export const checkTrafficRules = (currentAgv: AGV, allAgvs: AGV[], currentNodeObj: Node, nextNodeObj: Node): TrafficCheckResult => {
    let action: 'MOVE' | 'WAIT' | 'REPATH_HEAD_ON' = 'MOVE'; 
    let conflictReason: string | null = null;
    let avoidData: { type: 'edge', u: string, v: string } | null = null;
    let blockerId: number | null = null;

    // --- Hard Path Borrow Check (Level 2 Planning) ---
    // Check if my immediate next node (myNext) is reserved by someone else.
    if (currentAgv.progress < 0.05 && currentAgv.path.length > 0) {
        const myNextNode = currentAgv.path[0];
        const reservingAgv = allAgvs.find(other => 
            other.id !== currentAgv.id && 
            other.reservedNodes && 
            other.reservedNodes.includes(myNextNode)
        );

        if (reservingAgv) {
            // Found a higher priority reservation (someone claimed it first)
             action = 'WAIT';
             conflictReason = `Node ${myNextNode} Reserved`;
             blockerId = reservingAgv.id;
             return { action, conflictReason, avoidData, blockerId };
        }
    }
    // --------------------------------------------------

    for (const other of allAgvs) {
      if (other.id === currentAgv.id) continue;
      
      const myCurrent = currentAgv.currentNode;
      const myNext = currentAgv.path[0];
      const otherCurrent = other.currentNode;
      const otherNext = other.path[0];

      // 1. Head-On Collision Prevention
      if (myNext === otherCurrent && otherNext === myCurrent) {
         action = 'REPATH_HEAD_ON';
         avoidData = { type: 'edge', u: myCurrent, v: myNext };
         conflictReason = `Head-on w/ AGV-${other.id.toString().slice(-4)}`;
         blockerId = other.id;
         break;
      }

      // 2. "Borrow Path Blocked" (Node Entry Safety/Queueing)
      if (currentAgv.progress < 0.05) { 
          // Conflict A: Destination is already occupied by a stationary AGV
          if (otherCurrent === myNext && other.progress < 0.05) { 
             action = 'WAIT';
             conflictReason = `Dest ${myNext} Occupied`;
             blockerId = other.id;
             break;
          }
          
          // Conflict B: Destination Contention (Multiple AGVs targeting same node - Closer goes first)
          if (otherNext === myNext) {
              const myDist = Math.sqrt(Math.pow(nextNodeObj.x - currentAgv.x, 2) + Math.pow(nextNodeObj.y - currentAgv.y, 2));
              const otherDist = Math.sqrt(Math.pow(nextNodeObj.x - other.x, 2) + Math.pow(nextNodeObj.y - other.y, 2));
              
              // Priority Rule: Closer AGV gets the node.
              if (otherDist < myDist || (Math.abs(otherDist - myDist) < 5 && other.id < currentAgv.id)) {
                  action = 'WAIT';
                  conflictReason = `Yield Entry to ${myNext} (Queue)`;
                  blockerId = other.id;
                  break;
              }
          }
      }

      // 3. Node Occupied (Standard Check for Moving AGVs)
      if (myNext === otherCurrent) {
          const distToOther = Math.sqrt(Math.pow(currentNodeObj.x - other.x, 2) + Math.pow(currentNodeObj.y - other.y, 2));
          if (distToOther < 60) {
             action = 'WAIT';
             conflictReason = `Waiting Node ${myNext}`;
             blockerId = other.id;
             break;
          }
      }

      // 4. Merge Priority (Mid-Edge Conflict)
      if (myNext === otherNext && currentAgv.progress >= 0.05) {
          const myDist = Math.sqrt(Math.pow(nextNodeObj.x - currentAgv.x, 2) + Math.pow(nextNodeObj.y - currentAgv.y, 2));
          const otherDist = Math.sqrt(Math.pow(nextNodeObj.x - other.x, 2) + Math.pow(nextNodeObj.y - other.y, 2));
          
          if (myDist > otherDist + 15) { 
              action = 'WAIT';
              conflictReason = `Merge Yield`;
              blockerId = other.id;
              break;
          }
      }

      // 5. Directional Proximity (Front/Back Sensor)
      const physDist = Math.sqrt(Math.pow(currentAgv.x - other.x, 2) + Math.pow(currentAgv.y - other.y, 2));
      
      if (physDist < currentAgv.safetyDistance) {
          const dx = nextNodeObj.x - currentNodeObj.x;
          const dy = nextNodeObj.y - currentNodeObj.y;
          const headingAngle = Math.atan2(dy, dx);

          const otherDx = other.x - currentAgv.x;
          const otherDy = other.y - currentAgv.y;
          const angleToOther = Math.atan2(otherDy, otherDx);

          let diff = angleToOther - headingAngle;
          while (diff > Math.PI) diff -= 2 * Math.PI;
          while (diff < -Math.PI) diff += 2 * Math.PI;
          
          const isObstacleInFront = Math.abs(diff) < Math.PI / 2;

          if (isObstacleInFront) {
              const totalDist = Math.sqrt(dx*dx + dy*dy);
              const moveX = (dx / totalDist) * currentAgv.currentSpeed;
              const moveY = (dy / totalDist) * currentAgv.currentSpeed;
              const futureX = currentAgv.x + moveX;
              const futureY = currentAgv.y + moveY;
              const futureDist = Math.sqrt(Math.pow(futureX - other.x, 2) + Math.pow(futureY - other.y, 2));

              if (futureDist < physDist) {
                  action = 'WAIT';
                  conflictReason = 'Front Sensor: Stop';
                  blockerId = other.id;
                  break;
              }
          }
      }
    }

    return { action, conflictReason, avoidData, blockerId };
};
