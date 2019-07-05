import Sound from 'react-native-sound';
import RNAudioStreamer from 'react-native-audio-streamer';
import { DeviceEventEmitter } from 'react-native';
import MusicControl from 'react-native-music-control';

class AudioController {
	//Inicializa atributos
	constructor() {
		this.paused = true;
		this.playlist = [];

		/**
		 * Propriedades do áudio
		 * (*) Requerido
		 * key*, title*, url*, author, thumbnail, path, currentTime, duration
		 */
		this.currentAudio = {};
		this.type = 'streaming';

		//Instância do Sound ou do RNAudioStreamer
		this.player = null;

		//Indice do áudio atual
		this.currentIndex = 0;

		//Callbacks
		this.currentAudioListener = () => null;
		this.currentTimeListener = () => null;

		this.onChangeStatus = () => null;
		this.onChangeCurrentTime = () => null;

		//Status do áudio
		this.status = {
			PLAYING: 'PLAYING',
			LOADING: 'LOADING',
			LOADED: 'LOADED',
			PAUSED: 'PAUSED',
			STOPPED: 'STOPPED',
			SEEKING: 'SEEKING',
			ERROR: 'ERROR'
		};
	}

	/**
	 * Carrega a playlist, track inicial, e seta callback
	 * para mudança de estado do áudio e tempo atual do áudio
	 * 
	 * @param {*Array} playlist 
	 * @param {*Int} track 
	 * @param {*Function} onChangeStatus 
	 * @param {*Function} onChangeCurrentTime 
	 */
	init(playlist, track = 0, onChangeStatus, onChangeCurrentTime) {
		this.playlist = playlist;

		//Seta áudio atual como a track que o usuário passou
		this.currentAudio = playlist[track];
		this.currentIndex = track;

		//Seta listeners de mudança de estado e mudança de tempo atual do som
		this.onChangeStatus = onChangeStatus;
		this.onChangeCurrentTime = onChangeCurrentTime;

		this.onChangeStatus(this.status.LOADING);

		//Carrega o primeiro áudio
		this.load(this.currentAudio, (isLoaded) => isLoaded ?
			this.onChangeStatus(this.status.LOADED) : this.onChangeStatus(this.status.ERROR));

		//Adiciona listener para monitorar o estado do player de áudio streaming
		this.subscription = DeviceEventEmitter
			.addListener('RNAudioStreamerStatusChanged', this.onStatusChanged.bind(this));
	}

	onStatusChanged(status) {
		if (status === 'PAUSED' || status === 'PLAYING') {
			//Atualiza a duração do áudio streaming após mudança de estado
			this.getDuration(seconds => {
				this.currentAudio.duration = seconds;
			});
			this.onChangeStatus(this.status.LOADED);
		}
	}

	/**
	 * Carrega áudio e executa uma callback dizendo se foi carregado ou não
	 * 
	 * @param {*Object} audio 
	 * @param {*Function} isLoaded 
	 */
	load(audio, isLoaded) {
		this.musicControlReset();
		this.currentAudio = audio;
		//Verificar se o arquivo de áudio já foi baixado para definir player
		if (this.currentAudio.path) {
			//Áudio offline, this.player será instância do Sound
			this.type = 'offline';

			Sound.setCategory('Playback');
			this.player = new Sound(this.currentAudio.path,
				Sound.MAIN_BUNDLE,
				(error) => {
					if (error) return;

					//Executa callback se existir
					if (isLoaded) isLoaded(() => this.player.isLoaded());

					//Atualiza a duração do áudio
					this.getDuration(seconds => {
						this.currentAudio.duration = seconds;
					});
				}
			);
		} else {
			//Áudio online, this.player será instância do RNAudioStreamer
			this.type = 'streaming';
			this.player = RNAudioStreamer;
			this.player.setUrl(this.currentAudio.url);

			//Executa callback se existir
			if (isLoaded) isLoaded(true);
		}

		//Starta controle de áudio
		this.startMusicControl();
	}

	//------------ Funções básicas do player ------------//

	playerIsNull() {
		if (this.player == null) {
			this.onChangeStatus(this.status.ERROR);
			return true;
		}
		return false;
	}

	play() {
		if (this.playerIsNull()) return;

		//Da play no áudio streaming ou local
		if (this.type === 'streaming') {
			this.player.play();
		} else {
			this.player.play(this.onAudioFinish.bind(this));
		}

		//Starta função que executa callback de tempo atual do som
		this.onAudioProgressTime();

		//Configura Player e Music Control para iniciar de onde o usuário parou
		if (typeof this.currentAudio.currentTime !== 'undefined' &&
			this.currentAudio.currentTime >= 0) {
			this.seek(this.currentAudio.currentTime);
		}

		this.paused = false;
		this.onChangeStatus(this.status.PLAYING);
		this.musicControlPlay();
	}

	pause() {
		if (this.playerIsNull()) return;

		this.player.pause();

		//Salva o tempo atual do áudio
		this.currentAudio.currentTime = parseInt(this.currentAudio.currentTime, 10);

		//Para o listener de current time
		this.clearCurrentTimeListener();
		this.paused = true;
		this.onChangeStatus(this.status.PAUSED);
		this.musicControlPause();
	}

	seek(seconds) {
		if (this.playerIsNull()) return;
		//Se deu seek para final do áudio, para ele e coloca current time 0
		if (parseInt(seconds, 10) >= parseInt(this.currentAudio.duration, 10)) {
			this.clearCurrentTimeListener();
			this.player.pause();
			this.paused = true;
			this.musicControlPause();
			this.currentAudio.currentTime = 0;
			this.onChangeStatus(this.status.STOPPED);
			return;
		}

		//Aqui deve ser implementada uma chamada para a função seek, independente da biblioteca
		if (this.type === 'streaming') {
			this.player.seekToTime(seconds);
		} else {
			this.player.setCurrentTime(seconds);
		}

		const newCurrentTime = (seconds >= 0) ? seconds : 0;

		this.onChangeCurrentTime(newCurrentTime);

		//Atualiza tempo atual
		this.currentAudio.currentTime = newCurrentTime;
		this.currentAudioListener(seconds);
		this.musicControlSeek(seconds);
		this.musicControlRefresh();
	}

	seekToForward(seconds) {
		if (this.playerIsNull()) return;

		//Verifica se ao da forward chegou no final do áudio
		if (this.currentAudio.currentTime + seconds >= parseInt(this.currentAudio.duration, 10)) return;

		this.seek(this.currentAudio.currentTime + seconds);
	}

	skip(seconds) {
		if (this.playerIsNull()) return;

		//Aqui deve ser implementada uma chamada para a função skip, independente da biblioteca	
		this.getDuration(duration => {
			this.getCurrentTime(currentTime => {
				let time = currentTime + seconds;
				if (time < 0) time = 0;
				else if (time > duration) time = duration;
				this.seek(time); //seconds
			});
		});
	}

	hasTrack(index) {
		return this.playlist[index] !== undefined;
	}

	hasNext() {
		return this.playlist[this.currentIndex + 1] !== undefined;
	}

	hasPrevious() {
		return this.playlist[this.currentIndex - 1] !== undefined;
	}

	playNext() {
		this.playAnotherTrack(this.currentIndex + 1);
	}

	playPrevious() {
		this.playAnotherTrack(this.currentIndex - 1);
	}

	playAnotherTrack(index) {
		if (!this.hasTrack(index)) {
			return; // O próximo indice deve ser um indice válido na playlist
			//throw 'Playlist must contain index of next audio'
		}
		this.currentIndex = index;
		this.pause();
		this.selectedAudio = this.playlist[this.currentIndex];
		this.load(this.selectedAudio, (isLoaded) => {
			this.play();
			if (isLoaded) {
				if (this.type !== 'streaming') this.onChangeStatus(this.status.LOADED);
			} else return null;
		});
	}

	//------------ Callbacks ------------//	

	//Inicializa o current time listener
	onAudioProgressTime() {
		//Atualizando currentTime na audioProps
		this.currentTimeListener = setInterval(() => {
			this.getCurrentTime(seconds => {
				if (this.currentAudio.duration > 0 && seconds > this.currentAudio.duration) {
					this.player.pause();
					this.onChangeStatus(this.status.STOPPED);
					this.currentAudio.currentTime = 0;
					this.clearCurrentTimeListener();
				} else {
					this.currentAudio.currentTime = seconds;
					this.onChangeCurrentTime(seconds);
				}
			});
		}, 1000);
	}

	//Starta listener do current time
	startCurrentTimeListener() {
		this.onAudioProgressTime();
	}

	//Para listener do current time
	clearCurrentTimeListener() {
		clearInterval(this.currentTimeListener);
	}

	//Retorna tempo atual do áudio
	getCurrentTime(callback) {
		if (this.playerIsNull()) return;

		if (this.type === 'streaming') {
			this.player.currentTime((err, seconds) => {
				if (!err) callback(seconds);
			});
		} else {
			this.player.getCurrentTime(callback);
		}
	}

	setCurrentTime(seconds) {
		const secondsRound = parseInt(seconds, 10);
		if (this.type === 'streaming') this.player.seekToTime(secondsRound);
		else this.player.setCurrentTime(secondsRound);
		this.pause();
		this.play();
	}

	getDuration(callback) {
		if (this.playerIsNull()) return;

		if (this.type === 'streaming') {
			this.player.duration((err, seconds) => {
				if (!err && seconds > 0) callback(seconds);
				else callback(-1);
			});
		} else if (this.player.getDuration() > 0) {
			callback(this.player.getDuration());
		}
	}

	onAudioFinish() {
		this.musicControlReset();
		clearInterval(this.currentTimeListener);
	}

	//------------Alterar Estados do Music Control------------//

	musicControlsEnableControls() {
		MusicControl.enableControl('skipBackward', true, { interval: 30 });
		MusicControl.enableControl('skipForward', true, { interval: 30 });
		MusicControl.enableControl('play', true);
		MusicControl.enableControl('pause', true);
	}

	startMusicControl() {
		this.initializeMusicControlEvents();
		MusicControl.setNowPlaying({
			title: this.currentAudio.title, //OK
			artwork: this.currentAudio.thumbnailUri ? this.currentAudio.thumbnailUri : this.currentAudio.thumbnailLocal, //OK
			artist: this.currentAudio.author, //OK
			album: this.currentAudio.author ? this.currentAudio.author : ''
		});
		this.musicControlsEnableControls();
	}

	musicControlPause() {
		this.getCurrentTime((elapsedTime) => {
			MusicControl.updatePlayback({
				state: MusicControl.STATE_PAUSED,
				elapsedTime
			});
		});
	}

	musicControlPlay() {
		this.getCurrentTime((elapsedTime) => {
			MusicControl.updatePlayback({
				state: MusicControl.STATE_PLAYING,
				elapsedTime
			});
		});
	}

	musicControlRefresh() {
		this.getDuration((duration) => {
			this.getCurrentTime((elaspsedTime) => {
				MusicControl.updatePlayback({
					elaspsedTime,
					duration,
				});
			});
		});
	}

	musicControlSeek(elaspsedTime) {
		this.getDuration((duration) => {
			MusicControl.updatePlayback({
				elaspsedTime,
				duration
			});
		});
	}

	musicControlReset() {
		MusicControl.resetNowPlaying();
	}

	initializeMusicControlEvents() {
		MusicControl.on('pause', () => {
			this.pause();
			this.musicControlPause();
		});
		MusicControl.on('play', () => {
			this.play();
			this.musicControlPlay();
		});
		MusicControl.on('skipForward', () => {
			this.skip(30);
		}); // iOS only
		MusicControl.on('skipBackward', () => {
			this.skip(-30);
		}); // iOS only
	}
}

export default new AudioController();
