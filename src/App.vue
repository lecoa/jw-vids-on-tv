<template>
  <v-app id="inspire" class="tv-app" style="background-color: #1c1b1b">
    <v-main class="tv-main">
      <v-container class="tv-shell" fluid style="background-color: #1c1b1b">
        <v-row justify="center" class="tv-header-wrapper">
          <v-col cols="12" xl="10">
            <header class="tv-header">
              <div class="tv-actions">
                <v-btn class="mr-3" large outlined color="primary" @click="setSearchDialog(true)">
                  <v-icon left>mdi-magnify</v-icon>
                  {{ translations.lnkSearch || 'Search' }}
                </v-btn>
                <v-autocomplete
                  ref="langSelect"
                  v-model="siteLanguage"
                  :items="languages"
                  class="tv-language"
                  hide-details
                  prepend-icon="mdi-language"
                  :item-text="languageLabel"
                  item-value="locale"
                  outlined
                  dense
                ></v-autocomplete>
              </div>
            </header>
          </v-col>
        </v-row>

        <v-row v-if="ready && featuredVideo" justify="center">
          <v-col cols="12" xl="10">
            <v-card
              ref="featuredCard"
              class="tv-tile tv-featured"
              style="box-shadow: none; outline: none; border: none"
            >
              <div class="tv-featured-container">
                <div class="tv-featured-content">
                  <div class="tv-featured-meta">{{ featuredVideo.durationFormattedMinSec }}</div>
                  <h2 class="tv-featured-title">{{ featuredVideo.title }}</h2>
                  <div class="text-start">
                    <v-btn color="primary" rounded="xl" @click.stop="openVideo(featuredVideo)">
                      <v-icon left>mdi-play</v-icon>
                      {{ translations.lblPlay || 'Play' }}
                    </v-btn>
                  </div>
                </div>
                <div class="tv-featured-image-wrapper">
                  <v-img :src="featuredPoster" :aspect-ratio="16 / 9" class="tv-featured-image" />
                </div>
              </div>
            </v-card>
          </v-col>
        </v-row>

        <v-row v-if="ready && newestVideos.length" justify="center" class="mt-4 mt-md-8">
          <v-col cols="12" xl="10">
            <h3 class="tv-section-title">{{ tSectionTitle }}</h3>
            <div class="tv-grid">
              <v-card
                v-for="(video, index) in newestVideos"
                ref="newestCards"
                :key="video.guid"
                class="tv-tile tv-newest"
                :class="{
                  'tv-tile--focused': focusedSection === 'newest' && focusedIndex === index,
                }"
                tabindex="0"
                @focus="onNewestFocus(index)"
                @click="openVideo(video)"
                @keydown.enter.prevent="openVideo(video)"
              >
                <v-img :src="video.images.lss.lg" :aspect-ratio="16 / 9" class="tv-newest-image" />
                <div class="tv-newest-meta">
                  <div class="tv-newest-time">{{ video.durationFormattedMinSec }}</div>
                  <div class="tv-newest-title">{{ video.title }}</div>
                </div>
              </v-card>
            </div>
          </v-col>
        </v-row>
      </v-container>
    </v-main>
    <SearchDialog></SearchDialog>
    <VideoDialog></VideoDialog>
    <TranscriptDialog></TranscriptDialog>
  </v-app>
</template>

<script lang="ts">
import axios from 'axios';
import { Component, Vue, Watch } from 'vue-property-decorator';
import { Getter, Mutation, State } from 'vuex-class';

import VideoDialog from '@/components/VideoDialog.vue';
import SearchDialog from '@/components/SearchDialog.vue';
import TranscriptDialog from '@/components/TranscriptDialog.vue';
import { Language, Translations, Video } from './types';

@Component({
  components: {
    SearchDialog,
    VideoDialog,
    TranscriptDialog,
  },
})
export default class App extends Vue {
  ready: boolean = false;
  featuredVideo: Video | null = null;
  newestVideos: Video[] = [];
  latestVideosTitle: string = '';
  focusedSection: 'featured' | 'newest' = 'featured';
  focusedIndex: number = 0;

  @State((state) => state.route.params.language) routeLanguage!: string;

  @State mediatorUrl!: string;
  @State languages!: Language[];
  @State translations!: Translations;
  @State videoDialog!: boolean;
  @State searchDialog!: boolean;
  @State selectedVideo!: Video | null;

  @Getter getSiteLanguage!: Language;
  @Getter getSubtitleLanguage!: Language;
  @Mutation setSiteLanguage!: (value: string) => void;
  @Mutation setVideoLanguage!: (value: string) => void;
  @Mutation setSubtitleLanguage!: (value: string) => void;

  @Mutation setLanguages!: (value: Language[]) => void;
  @Mutation setTranslations!: (value: Translations) => void;
  @Mutation setSearchDialog!: (value: boolean) => void;
  @Mutation setSelectedVideo!: (value: Video | null) => void;
  @Mutation setVideoDialog!: (value: boolean) => void;

  async mounted() {
    this.$vuetify.theme.dark = true;
    this.setVideoLanguage('en');
    await this.fetchLanguages();
    this.ready = true;
    await this.fetchI18n();
    await this.fetchLatestVideos();
    this.syncVideoDialogWithRoute();

    if (this.routeLanguage !== this.preferredSiteLanguage) {
      this.updateRoute();
    }

    window.addEventListener('keydown', this.onGlobalKeydown);
    this.$nextTick(() => {
      this.focusCurrentTile();
    });
  }

  beforeDestroy() {
    window.removeEventListener('keydown', this.onGlobalKeydown);
  }

  updateRoute() {
    this.$router.push({
      name: 'Home',
      params: { language: this.siteLanguage },
      query: this.$route.query,
    });
  }

  // eslint-disable-next-line class-methods-use-this
  languageLabel(item: Language) {
    return item.name === item.vernacular ? item.name : `${item.name} (${item.vernacular})`;
  }

  languagesUrl(language: string) {
    return `${this.mediatorUrl}/languages/${language}/all?clientType=www`;
  }

  get translationsUrl() {
    return `${this.mediatorUrl}/translations/${this.getSiteLanguage.code}`;
  }

  get latestVideosUrl() {
    return `${this.mediatorUrl}/categories/${this.getSiteLanguage.code}/LatestVideos?detailed=1&clientType=www&limit=13`;
  }

  get featuredPoster() {
    return this.featuredVideo?.images.lsr.xl || this.featuredVideo?.images.lss.lg;
  }

  get tSectionTitle() {
    return (
      this.latestVideosTitle ||
      this.translations.lblRecentlyAdded ||
      this.translations.hdgVideos ||
      'Newest videos'
    );
  }

  // eslint-disable-next-line class-methods-use-this
  get preferredSiteLanguage() {
    const browserLocale = window.navigator.language.toLowerCase();
    return browserLocale.startsWith('nl') ? 'nl' : 'en';
  }

  get siteLanguage() {
    return this.getSiteLanguage?.locale ?? this.preferredSiteLanguage;
  }

  set siteLanguage(language: string) {
    if (language === null) return;
    this.setSiteLanguage(language);
  }

  get subtitleLanguage() {
    return this.getSubtitleLanguage?.locale ?? 'nl';
  }

  set subtitleLanguage(language: string) {
    if (language === null) return;
    this.setSubtitleLanguage(language);
  }

  get newestCardRefs() {
    const refs = this.$refs.newestCards;
    if (!refs) {
      return [];
    }
    return Array.isArray(refs) ? refs : [refs];
  }

  // eslint-disable-next-line class-methods-use-this
  static getColsPerRow(): number {
    const width = window.innerWidth;
    if (width >= 1260) {
      return 4; // xl breakpoint and up
    }
    if (width >= 960) {
      return 3; // lg breakpoint
    }
    if (width >= 600) {
      return 2; // md breakpoint
    }
    return 1; // xs breakpoint
  }

  // Vuetify refs resolve to Vue component instances; focus must be applied to the root element.
  static getFocusableElement(target: unknown) {
    if (target instanceof HTMLElement) {
      return target;
    }

    const maybeComponent = target as Vue | undefined;
    if (maybeComponent?.$el instanceof HTMLElement) {
      return maybeComponent.$el;
    }

    return null;
  }

  get routeVideoKey() {
    const { video } = this.$route.query;
    if (Array.isArray(video)) {
      return video[0] ?? null;
    }
    if (typeof video !== 'string' || video.length === 0) {
      return null;
    }
    return video;
  }

  openVideo(video: Video) {
    this.setSelectedVideo(video);
    // When opening a video: set video language to English and subtitles to site language
    this.setVideoLanguage('en');
    this.setSubtitleLanguage(this.siteLanguage);

    if (this.routeVideoKey !== video.languageAgnosticNaturalKey) {
      this.$router.push({
        name: 'Home',
        params: { language: this.siteLanguage },
        query: { video: video.languageAgnosticNaturalKey },
      });
    }

    this.setVideoDialog(true);
  }

  syncVideoDialogWithRoute() {
    if (this.routeVideoKey === null) {
      if (this.videoDialog) {
        this.setVideoDialog(false);
      }
      if (this.selectedVideo) {
        this.setSelectedVideo(null);
      }
      return;
    }

    const videos = [this.featuredVideo, ...this.newestVideos].filter(Boolean) as Video[];
    const matchedVideo = videos.find(
      (video) => video.languageAgnosticNaturalKey === this.routeVideoKey,
    );

    if (matchedVideo) {
      this.setSelectedVideo(matchedVideo);
      this.setVideoDialog(true);
      return;
    }

    if (
      this.selectedVideo?.languageAgnosticNaturalKey === this.routeVideoKey &&
      !this.videoDialog
    ) {
      this.setVideoDialog(true);
      return;
    }

    // If video not found in main feed, try to fetch it from the API (e.g., from search results)
    if (
      this.selectedVideo === null ||
      this.selectedVideo.languageAgnosticNaturalKey !== this.routeVideoKey
    ) {
      this.fetchVideoByKey(this.routeVideoKey);
    }
  }

  async fetchVideoByKey(languageAgnosticNaturalKey: string) {
    try {
      const url = `${this.mediatorUrl}/media-items/${this.getSiteLanguage.code}/${languageAgnosticNaturalKey}?clientType=www`;
      const response = await axios.get(url);
      const [video] = response.data.media;
      if (video) {
        this.setSelectedVideo(video);
        this.setVideoDialog(true);
      }
    } catch (error) {
      // Video not found or error fetching - silently fail
    }
  }

  onFeaturedFocus() {
    this.focusedSection = 'featured';
  }

  onNewestFocus(index: number) {
    this.focusedSection = 'newest';
    this.focusedIndex = index;
  }

  focusCurrentTile() {
    if (this.focusedSection === 'featured') {
      const featuredCard = App.getFocusableElement(this.$refs.featuredCard);
      featuredCard?.focus();
      return;
    }

    const card = App.getFocusableElement(this.newestCardRefs[this.focusedIndex]);
    if (!card) {
      return;
    }

    card.focus();
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }

  onGlobalKeydown(event: KeyboardEvent) {
    if (this.videoDialog || this.searchDialog || !this.ready) {
      return;
    }

    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(event.key)) {
      return;
    }

    if (event.key === 'Enter') {
      if (this.focusedSection === 'featured' && this.featuredVideo) {
        this.openVideo(this.featuredVideo);
      }
      if (this.focusedSection === 'newest' && this.newestVideos[this.focusedIndex]) {
        this.openVideo(this.newestVideos[this.focusedIndex]);
      }
      event.preventDefault();
      return;
    }

    if (
      this.focusedSection === 'featured' &&
      event.key === 'ArrowDown' &&
      this.newestVideos.length
    ) {
      this.focusedSection = 'newest';
      this.focusedIndex = 0;
      event.preventDefault();
      this.$nextTick(() => this.focusCurrentTile());
      return;
    }

    if (this.focusedSection === 'newest') {
      if (event.key === 'ArrowUp') {
        this.focusedSection = 'featured';
        event.preventDefault();
        this.$nextTick(() => this.focusCurrentTile());
        return;
      }
      // For grid: use arrow keys to move within grid
      const colsPerRow = App.getColsPerRow();
      if (event.key === 'ArrowLeft') {
        this.focusedIndex = Math.max(0, this.focusedIndex - 1);
        event.preventDefault();
        this.$nextTick(() => this.focusCurrentTile());
        return;
      }
      if (event.key === 'ArrowRight') {
        this.focusedIndex = Math.min(this.newestVideos.length - 1, this.focusedIndex + 1);
        event.preventDefault();
        this.$nextTick(() => this.focusCurrentTile());
        return;
      }
      if (event.key === 'ArrowDown') {
        const nextIndex = this.focusedIndex + colsPerRow;
        if (nextIndex < this.newestVideos.length) {
          this.focusedIndex = nextIndex;
          event.preventDefault();
          this.$nextTick(() => this.focusCurrentTile());
        }
      }
    }
  }

  @Watch('routeLanguage')
  onRouteLanguageChange(newLang: string) {
    if (newLang && newLang !== this.siteLanguage) {
      this.setSiteLanguage(newLang);
    }
  }

  @Watch('$route')
  onRouteChange() {
    this.syncVideoDialogWithRoute();
  }

  @Watch('siteLanguage')
  onSiteLanguageChange() {
    (this.$refs.langSelect as { blur?: () => void } | undefined)?.blur?.();
    this.updateRoute();
    this.fetchI18n();
    this.fetchLatestVideos();
  }

  async fetchI18n() {
    await Promise.allSettled([this.fetchLanguages(), this.fetchTranslations()]);
  }

  async fetchLatestVideos() {
    type CategoryRequest = { category: { name?: string; media: Video[] } };
    const { category } = (await axios.get<CategoryRequest>(this.latestVideosUrl)).data;
    this.latestVideosTitle = category?.name ?? '';
    const latestMedia = category?.media ?? [];
    this.featuredVideo = latestMedia[0] ?? null;
    this.newestVideos = latestMedia.slice(1, 13);
  }

  async fetchLanguages() {
    type LanguagesRequest = { languages: Language[] };
    const url = this.languagesUrl(this.ready ? this.getSiteLanguage.code : '-');
    const { languages } = (await axios.get<LanguagesRequest>(url)).data;

    // Pinning items to the top of a list has never been harder
    const dutch = languages.filter((language) => language.locale === 'nl')[0];
    const english = languages.filter((language) => language.locale === 'en')[0];
    const remainder = languages.filter(
      (language) => language.locale !== 'nl' && language.locale !== 'en',
    );
    remainder.unshift(dutch, english);
    this.setLanguages(remainder);
  }

  async fetchTranslations() {
    type TranslationsRequest = { translations: { [key: string]: Translations } };
    const response = await axios.get<TranslationsRequest>(this.translationsUrl);
    const translations = response.data.translations[this.getSiteLanguage.code];
    this.setTranslations(translations);
  }

  @Watch('videoDialog')
  onVideoDialogChanged(dialogOpen: boolean) {
    if (!dialogOpen) {
      if (this.routeVideoKey !== null) {
        this.$router.replace({
          name: 'Home',
          params: { language: this.siteLanguage },
        });
      }
      this.$nextTick(() => this.focusCurrentTile());
    }
  }
}
</script>
<style lang="scss">
* {
  scrollbar-width: thin;
}

html {
  min-height: 100%;
  overflow-x: hidden;
  background: #1c1b1b;
}

body {
  min-height: 100%;
  overflow-x: hidden;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.v-main {
  min-height: 100dvh;
}

.v-main__wrap {
  min-height: 0;
  overflow: visible;
  height: auto;
}

.tv-app {
  background: #1c1b1b;
}

.tv-main {
  color: #f2f2f2;
}

.tv-shell {
  padding-bottom: calc(48px + env(safe-area-inset-bottom));
}

.tv-header {
  align-items: flex-end;
  display: flex;
  justify-content: space-between;
}

.tv-title {
  font-size: clamp(2rem, 5vw, 3.2rem);
  letter-spacing: 0.04em;
  line-height: 1.05;
  margin: 0;
  text-transform: uppercase;
}

.tv-subtitle {
  color: rgba(255, 255, 255, 0.78);
  font-size: 1.05rem;
  margin: 8px 0 0;
}

.tv-actions {
  align-items: center;
  display: flex;
  gap: 8px;
}

.tv-language {
  max-width: 240px;
  min-width: 220px;
}

.tv-tile {
  border: 2px solid transparent;
  border-radius: 14px;
  cursor: pointer;
  overflow: hidden;
  transition: transform 180ms ease, border-color 180ms ease, box-shadow 180ms ease;
}

.tv-tile:focus-visible,
.tv-tile--focused {
  border-color: #4aa750;
  box-shadow: 0 0 0 3px rgba(74, 109, 167, 0.35);
  outline: none;
  transform: scale(1.02);
}

.tv-featured {
  display: flex;
  overflow: hidden;
}

.tv-featured-container {
  display: flex;
  width: 100%;
  align-items: stretch;
}

.tv-featured-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  background-color: #1c1b1b;
}

.tv-featured-image-wrapper {
  flex: 1;
  position: relative;
  overflow: hidden;
}

.tv-featured-image {
  width: 100%;
  height: 100%;
  position: relative;
}

.tv-featured-image::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: radial-gradient(at right top, rgba(28, 27, 27, 0.1) 0%, rgba(28, 27, 27, 1) 85%);
  pointer-events: none;
  z-index: 1;
}

.tv-featured-meta {
  color: rgba(255, 255, 255, 0.78);
  font-size: 0.95rem;
  margin-bottom: 8px;
}

.tv-featured-title {
  font-size: clamp(1.5rem, 3vw, 2.8rem);
  line-height: 1.12;
  margin: 0 0 12px 0;
  text-wrap: balance;
}

.tv-featured-description {
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  color: rgba(255, 255, 255, 0.86);
  display: -webkit-box;
  margin-bottom: 20px;
  max-width: 72ch;
  overflow: hidden;
}

.tv-section-title {
  color: rgba(255, 255, 255, 0.95);
  font-size: clamp(1.2rem, 2vw, 1.6rem);
  letter-spacing: 0.02em;
  margin-bottom: 16px;
}

.tv-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.tv-newest {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.tv-newest-image {
  flex-shrink: 0;
}

.tv-newest-meta {
  padding: 12px 14px 14px;
  background: rgba(20, 20, 20, 0.7);
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.tv-newest-time {
  color: rgba(255, 255, 255, 0.75);
  font-size: 0.85rem;
  margin-bottom: 4px;
}

.tv-newest-title {
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  color: #ffffff;
  display: -webkit-box;
  font-size: 1rem;
  line-height: 1.3;
  overflow: hidden;
  font-weight: 500;
}

@media (min-width: 960px) {
  .tv-featured-container {
    min-height: 420px;
  }

  .tv-grid {
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  }

  .tv-header-wrapper {
    margin-bottom: -85px;
    z-index: 100;
    position: relative;
  }
}

@media (max-width: 959px) {
  .tv-header {
    align-items: flex-start;
    flex-direction: column;
    gap: 16px;
  }

  .tv-actions {
    flex-wrap: wrap;
    width: 100%;
  }

  .tv-featured-container {
    flex-direction: column;
    min-height: auto;
  }

  .tv-featured-content {
    order: 2;
    padding: clamp(16px, 3vw, 24px);
  }

  .tv-featured-image-wrapper {
    order: 1;
    min-height: 280px;
  }

  .tv-grid {
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  }

  .tv-featured-content {
    justify-content: start;
  }

  .tv-header {
    margin-bottom: -50px;
  }
}
</style>
