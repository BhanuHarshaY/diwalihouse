import { SiteFooter } from '@/components/SiteFooter';
import { HomeHeader } from '@/scenes/home/HomeHeader';
import { SceneDiya } from '@/scenes/home/SceneDiya';
import { SceneEnter } from '@/scenes/home/SceneEnter';
import { ScenePeople } from '@/scenes/home/ScenePeople';
import { SceneRangoli } from '@/scenes/home/SceneRangoli';
import { SceneStories } from '@/scenes/home/SceneStories';

export default function HomePage() {
  return (
    <>
      <HomeHeader />
      <main id="main">
        <SceneDiya />
        <SceneStories />
        <SceneRangoli />
        <ScenePeople />
        <SceneEnter />
      </main>
      <SiteFooter />
    </>
  );
}
