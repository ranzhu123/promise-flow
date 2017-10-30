const del = require('del');
const gulp = require('gulp');
const babel = require('gulp-babel');

gulp.task('clean', () => {
    return del([
        'dist/**/*'
    ]);
});

gulp.task('build', ['clean'], () => {
    gulp.src('lib/**/*').pipe(babel()).pipe(gulp.dest('dist/'));
});

module.exports = gulp;
