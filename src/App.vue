<template>
  <v-app id="inspire" class="tv-app" style="background-color: rgb(10, 12, 12)">
    <v-main class="tv-main">
      <v-container class="tv-shell" fluid style="background-color: rgb(10, 12, 12)">
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
                  prepend-icon="mdi-subtitles"
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
              class="tv-featured"
              style="box-shadow: none; outline: none; border: none"
            >
              <div class="tv-featured-container">
                <div class="tv-featured-content">
                  <div class="tv-featured-meta">{{ featuredVideo.durationFormattedMinSec }}</div>
                  <h2 class="tv-featured-title">{{ featuredVideo.title }}</h2>
                  <div class="text-start">
                    <v-btn
                      color="primary"
                      rounded="xl"
                      @click.stop="openVideo(featuredVideo)"
                      tabindex="0"
                      class="tv-play-btn"
                    >
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
                v-for="video in newestVideos"
                :key="video.guid"
                class="tv-tile tv-newest"
                tabindex="0"
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
// @ts-ignore
import SpatialNavigation from 'js-spatial-navigation';

import VideoDialog from '@/components/VideoDialog.vue';
import SearchDialog from '@/components/SearchDialog.vue';
import TranscriptDialog from '@/components/TranscriptDialog.vue';
import { isBackKey } from '@/utils/remote-navigation';
import { Language, Translations, Video } from './types';

const SECTION_MAIN = 'sn-main';

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
  lastFocusedElement: HTMLElement | null = null;

  @State((state) => state.route.params.language) routeLanguage!: string;

  @State mediatorUrl!: string;
  @State languages!: Language[];
  @State translations!: Translations;
  @State videoDialog!: boolean;
  @State searchDialog!: boolean;
  @State transcriptDialog!: boolean;
  @State selectedVideo!: Video | null;

  @Getter getSiteLanguage!: Language;
  @Getter getSubtitleLanguage!: Language;
  @Mutation setSiteLanguage!: (value: string) => void;
  @Mutation setVideoLanguage!: (value: string) => void;
  @Mutation setSubtitleLanguage!: (value: string) => void;

  @Mutation setLanguages!: (value: Language[]) => void;
  @Mutation setTranslations!: (value: Translations) => void;
  @Mutation setSearchDialog!: (value: boolean) => void;
  @Mutation setTranscriptDialog!: (value: boolean) => void;
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

    // Initialize spatial navigation
    SpatialNavigation.init();
    SpatialNavigation.add(SECTION_MAIN, {
      selector: '[tabindex="0"]',
      enterTo: 'last-visited',
      rememberSource: true,
    });
    SpatialNavigation.focus(SECTION_MAIN);

    // Setup global key handler for back button and dialog toggling
    window.addEventListener('keydown', this.onGlobalKeydown);
  }

  beforeDestroy() {
    SpatialNavigation.destroy();
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
    // remember last focused element so we can restore focus after closing video
    this.lastFocusedElement =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
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

  onGlobalKeydown(event: KeyboardEvent) {
    if (isBackKey(event)) {
      if (this.transcriptDialog) {
        this.setTranscriptDialog(false);
        event.preventDefault();
        return;
      }

      if (this.videoDialog) {
        this.setVideoDialog(false);
        event.preventDefault();
        return;
      }

      if (this.searchDialog) {
        this.setSearchDialog(false);
        event.preventDefault();
        return;
      }

      this.$router.back();
      event.preventDefault();
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
    this.setSubtitleLanguage(this.siteLanguage);
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
      this.$nextTick(() => {
        // restore previously focused element in main section when video dialog closes
        if (this.lastFocusedElement && document.contains(this.lastFocusedElement)) {
          try {
            this.lastFocusedElement.focus();
            SpatialNavigation.focus(SECTION_MAIN, this.lastFocusedElement);
          } catch (e) {
            SpatialNavigation.focus(SECTION_MAIN);
          }
        } else {
          SpatialNavigation.focus(SECTION_MAIN);
        }
        this.lastFocusedElement = null;
      });
    }
  }
}
</script>
<style lang="scss">
:root {
  color-scheme: dark;
  --tv-bg: #101112;
  --tv-surface: rgba(26, 31, 36, 0.96);
  --tv-surface-strong: #20262c;
  --tv-accent: #41d68d;
  --tv-accent-soft: rgba(65, 214, 141, 0.18);
  --tv-focus: rgba(65, 214, 141, 0.55);
  --tv-text: #f5f7f8;
  --tv-text-muted: rgba(245, 247, 248, 0.74);
  --tv-shadow: 0 24px 60px rgba(0, 0, 0, 0.45);
  --tv-radius-lg: 28px;
  --tv-radius-md: 20px;
  --tv-radius-sm: 16px;
}

* {
  scrollbar-width: thin;
}

html {
  min-height: 100%;
  overflow-x: hidden;
  background: radial-gradient(circle at top, rgba(65, 214, 141, 0.12), transparent 36%),
    linear-gradient(180deg, #101112 0%, #14181d 42%, #101112 100%);
  font-size: 18px;
}

body {
  min-height: 100%;
  overflow-x: hidden;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  background: transparent;
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
  background: transparent;
}

.tv-main {
  color: var(--tv-text);
}

.tv-shell {
  padding: clamp(32px, 4vw, 72px) clamp(20px, 4vw, 56px) calc(56px + env(safe-area-inset-bottom));
}

.tv-header {
  align-items: flex-end;
  display: flex;
  justify-content: space-between;
  margin-inline: clamp(24px, 4vw, 44px);
}

.col-xl-10:has(> .tv-header) {
  padding-inline: 0 !important;
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
  gap: 14px;
}

.tv-language {
  max-width: 320px;
  min-width: 280px;
}

.tv-actions :deep(.v-btn),
.tv-actions :deep(.v-input) {
  border-radius: var(--tv-radius-sm);
  font-size: 1rem;
}

.tv-actions :deep(.v-btn) {
  min-height: 58px;
  padding-inline: 22px;
}

.tv-actions :deep(.v-input__slot) {
  min-height: 58px !important;
}

.tv-actions :deep(.v-label),
.tv-actions :deep(.v-select__selection),
.tv-actions :deep(input) {
  font-size: 1rem;
}

.tv-actions :deep(.v-icon) {
  font-size: 1.5rem;
}

.tv-featured,
.tv-tile {
  border: 2px solid rgba(255, 255, 255, 0.06);
  border-radius: var(--tv-radius-lg);
  overflow: hidden;
  box-shadow: var(--tv-shadow);
  transition: transform 180ms ease, border-color 180ms ease, box-shadow 180ms ease,
    background-color 180ms ease;
  will-change: transform;
}

.tv-featured:has(.tv-play-btn:focus-visible),
.tv-featured:has(.tv-play-btn:hover),
.tv-tile:hover,
.tv-tile:focus-visible,
.tv-tile--focused {
  border-color: rgba(65, 214, 141, 0.92);
  box-shadow: 0 0 0 3px var(--tv-focus), 0 28px 70px rgba(0, 0, 0, 0.58);
  outline: none;
  transform: scale(1.03) translateY(-2px);
}

.tv-tile:active {
  transform: scale(0.99);
}

.tv-featured {
  display: flex;
  overflow: hidden;
  background: linear-gradient(135deg, rgba(26, 36, 31, 0.98), rgba(18, 26, 21, 0.98));
}

.tv-play-btn:focus-visible,
.tv-play-btn:hover {
  box-shadow: 0 0 0 4px var(--tv-focus) !important;
  outline: none;
  transform: scale(1.04);
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
  background: linear-gradient(180deg, rgba(16, 18, 16, 0.16), rgba(16, 18, 17, 0.88)),
    linear-gradient(135deg, rgba(26, 36, 29, 0.92), rgba(20, 28, 25, 0.98));
  padding: clamp(24px, 4vw, 44px);
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
  background: radial-gradient(at right top, rgba(16, 18, 17, 0.08) 0%, rgba(16, 18, 17, 0.98) 88%);
  pointer-events: none;
  z-index: 1;
}

.tv-featured-meta {
  color: var(--tv-text-muted);
  font-size: 1rem;
  letter-spacing: 0.04em;
  margin-bottom: 12px;
}

.tv-featured-title {
  font-size: clamp(2.2rem, 4vw, 4.25rem);
  line-height: 1.02;
  margin: 0 0 20px 0;
  text-wrap: balance;
  max-width: 14ch;
}

.tv-featured-description {
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  color: rgba(245, 247, 248, 0.88);
  display: -webkit-box;
  margin-bottom: 24px;
  max-width: 72ch;
  overflow: hidden;
  font-size: 1.02rem;
}

.tv-section-title {
  color: var(--tv-text);
  font-size: clamp(1.5rem, 2vw, 2rem);
  letter-spacing: 0.03em;
  margin-bottom: 20px;
  text-transform: uppercase;
}

.tv-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 22px;
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
  padding: 18px 20px 20px;
  background: linear-gradient(180deg, rgba(24, 32, 28, 0.9), rgba(18, 25, 20, 0.96));
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.tv-newest-time {
  color: var(--tv-text-muted);
  font-size: 0.95rem;
  margin-bottom: 8px;
  letter-spacing: 0.03em;
}

.tv-newest-title {
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  color: #ffffff;
  display: -webkit-box;
  font-size: 1.1rem;
  line-height: 1.35;
  overflow: hidden;
  font-weight: 500;
}

@media (min-width: 960px) {
  .tv-featured-container {
    min-height: 520px;
  }

  .tv-grid {
    grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  }

  .tv-header-wrapper {
    margin-bottom: -110px;
    z-index: 100;
    position: relative;
  }
}

@media (max-width: 959px) {
  .tv-header {
    align-items: flex-start;
    flex-direction: column;
    gap: 18px;
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
  }

  .tv-featured-image-wrapper {
    order: 1;
    min-height: 340px;
  }

  .tv-grid {
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  }

  .tv-featured-content {
    justify-content: start;
  }
}
</style>
