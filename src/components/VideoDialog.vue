<template>
  <v-dialog
    v-model="dialog"
    @click:outside="dialog = false"
    max-width="900px"
    transition="dialog-bottom-transition"
    fullscreen
  >
    <v-card v-if="selectedVideo">
      <v-responsive v-if="loading || !videoMedia" :aspect-ratio="16 / 9" key="loading">
        <v-container fill-height fluid>
          <v-row justify="center">
            <v-col align="center">
              <v-progress-circular indeterminate color="primary" size="48"></v-progress-circular>
            </v-col>
          </v-row>
        </v-container>
      </v-responsive>
      <v-responsive v-else-if="videoMedia" style="height: 100vh; width: 100vw" key="video">
        <video
          id="player"
          controls
          crossorigin
          playsinline
          :poster="videoPoster"
          autoplay
          style="width: 100%; height: 100%; object-fit: cover"
        >
          <source
            v-for="file in videoMedia.files.slice().reverse()"
            :key="file.label"
            :src="file.progressiveDownloadURL"
            :type="file.mimetype"
            :label="file.label"
            :size="file.label.slice(0, -1)"
          />
          <track
            v-if="captionUrl"
            :src="captionUrl"
            kind="captions"
            :srclang="getVideoLanguage.locale"
            :label="languageLabel(getVideoLanguage)"
          />
          <track
            v-if="subtitleUrl"
            :src="subtitleUrl"
            kind="subtitles"
            :default="true"
            :srclang="getSubtitleLanguage.locale"
            :label="languageLabel(getSubtitleLanguage)"
          />
          Your browser does not support the video tag.
        </video>
      </v-responsive>
    </v-card>
  </v-dialog>
</template>

<script lang="ts">
import axios from 'axios';
import { Component, Vue, Watch } from 'vue-property-decorator';
import { Getter, Mutation, State } from 'vuex-class';

// @ts-ignore
import Plyr, { Track } from 'plyr';

import { Language, Video } from '@/types';

import CastButton from './button/CastButton.vue';
import VideoButton from './button/VideoButton.vue';
import SubtitleButton from './button/SubtitleButton.vue';

@Component({
  components: {
    CastButton,
    VideoButton,
    SubtitleButton,
  },
})
export default class VideoDialog extends Vue {
  player: Plyr | null = null;
  loading: boolean = true;
  videoMedia: Video | null = null;
  subtitleMedia: Video | null = null;

  @State mediatorUrl!: string;
  @State languages!: Language[];
  @State translations!: { [key: string]: string };

  @State videoDialog!: boolean;
  @State selectedVideo!: Video;
  @Mutation setVideoDialog!: (value: boolean) => void;
  @Mutation setSelectedVideo!: (value: Video | null) => void;

  @Getter getSiteLanguage!: Language;
  @Getter getVideoLanguage!: Language;
  @Getter getSubtitleLanguage!: Language;
  @Mutation setVideoLanguage!: (value: string) => void;
  @Mutation setSubtitleLanguage!: (value: string) => void;

  // eslint-disable-next-line class-methods-use-this
  languageLabel(item: Language) {
    return item.name === item.vernacular ? item.name : `${item.name} (${item.vernacular})`;
  }

  get xsOnly() {
    return this.$vuetify.breakpoint.xsOnly;
  }

  get videoTitle() {
    return (this.selectedVideo ?? this.videoMedia)?.title;
  }

  get videoPoster() {
    return (this.selectedVideo ?? this.videoMedia)?.images.wss.lg;
  }

  get jwOrgUrl() {
    const { locale } = this.getSiteLanguage;
    const { primaryCategory, languageAgnosticNaturalKey } =
      this.selectedVideo ?? this.videoMedia ?? {};
    return `https://www.jw.org/finder?locale=${locale}&category=${primaryCategory}&lank=${languageAgnosticNaturalKey}`;
  }

  get captionUrl() {
    const found = this.videoMedia?.files.find((file) => file?.subtitles?.url !== undefined);
    if (found === undefined) return null;
    return found.subtitles.url;
  }

  get subtitleUrl() {
    const found = this.subtitleMedia?.files.find((file) => file?.subtitles?.url !== undefined);
    if (found === undefined) return null;
    return found.subtitles.url;
  }

  get availableLanguages() {
    if (!this.selectedVideo) {
      return [];
    }
    return this.languages.filter((language) =>
      this.selectedVideo.availableLanguages.includes(language.code),
    );
  }

  get dialog() {
    return this.videoDialog;
  }

  set dialog(value) {
    this.setVideoDialog(value);
  }

  get videoLanguage() {
    return this.getVideoLanguage.locale ?? this.getSiteLanguage.locale;
  }

  set videoLanguage(language: string) {
    if (language === null) return;
    this.setVideoLanguage(language);
  }

  get subtitleLanguage() {
    return this.getSubtitleLanguage.locale ?? 'nl';
  }

  set subtitleLanguage(language: string) {
    if (language === null) return;
    this.setSubtitleLanguage(language);
  }

  get videoOptions(): Plyr.Options {
    return {
      quality: {
        default: 1080,
        options: [1080, 720, 480, 360, 240, 144],
      },
      captions: {
        active: true,
        language: this.getSubtitleLanguage.locale,
        update: true,
      },
    };
  }

  getMediaUrl(language: Language) {
    return `${this.mediatorUrl}/media-items/${language.code}/${this.selectedVideo?.languageAgnosticNaturalKey}?clientType=www`;
  }

  loadPlayer() {
    if (this.player) {
      this.player.destroy();
    }

    this.player = new Plyr('#player', this.videoOptions);
    const tracks: Track[] = [];
    if (this.captionUrl) {
      tracks.push({
        kind: 'captions',
        label: this.languageLabel(this.getVideoLanguage),
        srcLang: this.getVideoLanguage.locale,
        src: this.captionUrl,
      });
    }
    if (this.subtitleUrl) {
      tracks.push({
        kind: 'subtitles',
        label: this.languageLabel(this.getSubtitleLanguage),
        srcLang: this.getSubtitleLanguage.locale,
        src: this.subtitleUrl,
      });
    }
    this.player.source = {
      type: 'video',
      poster: this.videoPoster,
      title: this.selectedVideo.title,
      sources:
        this.videoMedia?.files.map((file) => ({
          src: file.progressiveDownloadURL,
          type: file.mimetype,
          size: parseInt(file.label.slice(0, -1), 10),
        })) ?? [],
      tracks,
    };
    this.player.fullscreen.enter();
  }

  async loadMediaItems() {
    this.loading = true;
    if (this.videoMedia === null) {
      [this.videoMedia] = (await axios.get(this.getMediaUrl(this.getVideoLanguage))).data.media;
    }
    if (this.selectedVideo === null) {
      this.setSelectedVideo(this.videoMedia);
    }
    if (this.subtitleMedia === null) {
      [this.subtitleMedia] = (
        await axios.get(this.getMediaUrl(this.getSubtitleLanguage))
      ).data.media;
    }
    this.loading = false;
  }

  @Watch('loading')
  onLoadingChange(loading: boolean) {
    if (!loading) {
      this.$nextTick(() => {
        this.loadPlayer();
      });
    }
  }

  @Watch('videoDialog')
  onVideoDialogChange(active: boolean) {
    if (!active) {
      // @ts-ignore
      if (this.player?.media) {
        this.player.stop();
      } else {
        document.querySelector('video')?.pause();
      }
    }
  }

  @Watch('selectedVideo')
  onSelectedVideoChange(video: Video) {
    if (video === null) {
      return;
    }
    this.videoMedia = null;
    this.subtitleMedia = null;
    if (this.getSiteLanguage.locale === this.videoLanguage) {
      this.videoMedia = video;
    }
    if (this.getSiteLanguage.locale === this.subtitleLanguage) {
      this.subtitleMedia = video;
    }
    this.loadMediaItems();
  }

  @Watch('videoLanguage')
  onVideoLanguageChange() {
    (this.$refs.vidLangSelect as any).blur();
    this.videoMedia = null;
    this.loadMediaItems();
  }

  @Watch('subtitleLanguage')
  onSubtitleLanguageChange() {
    (this.$refs.subLangSelect as any).blur();
    this.subtitleMedia = null;
    this.loadMediaItems();
  }
}
</script>
<style lang="scss">
.img-loading {
  .v-image__image {
    filter: blur(5px);
  }
}

.plyr {
  height: 100%;
  --plyr-font-size-xlarge: 36px;
  --plyr-font-size-large: 22px;
  --plyr-color-main: #4aa750;
}

.plyr__poster {
  background-size: cover !important;
}
</style>
