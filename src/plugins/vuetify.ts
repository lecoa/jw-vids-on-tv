import Vue from 'vue';
import Vuetify from 'vuetify/lib/framework';

Vue.use(Vuetify);

export default new Vuetify({
  theme: {
    themes: {
      light: {
        primary: '#41d68d',
        secondary: '#1f2833',
        accent: '#7ef0bc',
        background: '#101112',
        surface: '#1a1f24',
      },
      dark: {
        primary: '#41d68d',
        secondary: '#1f2833',
        accent: '#7ef0bc',
        background: '#101112',
        surface: '#1a1f24',
      },
    },
  },
});
