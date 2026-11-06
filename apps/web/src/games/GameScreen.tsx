'use client';

import type { CharadesView } from '@diwali/charades';
import type { RajaMantriView } from '@diwali/raja-mantri';
import type { TambolaView } from '@diwali/tambola';
import type { TableView } from '@diwali/teen-patti';
import { TeenPattiTable } from '@/cards/TeenPattiTable';
import { useGameRoom } from '@/realtime/useGameRoom';
import { CharadesGame } from './CharadesGame';
import { RajaMantriGame } from './RajaMantriGame';
import { Connecting } from './shared';
import { TambolaGame } from './TambolaGame';

/** One socket per game; the room's own kind decides which game screen to show. */
export function GameScreen({ partyId, game }: { partyId: string; game: string }) {
  const room = useGameRoom(partyId, game);
  if (!room.kind || !room.view) return <Connecting status={room.status} />;
  const common = {
    partyId,
    profiles: room.profiles,
    events: room.events,
    status: room.status,
    request: room.request,
  };
  switch (room.kind) {
    case 'teen-patti':
      return <TeenPattiTable {...common} view={room.view as TableView} />;
    case 'tambola':
      return <TambolaGame {...common} view={room.view as TambolaView} />;
    case 'raja-mantri':
      return <RajaMantriGame {...common} view={room.view as RajaMantriView} />;
    case 'charades':
      return <CharadesGame {...common} view={room.view as CharadesView} />;
  }
}
