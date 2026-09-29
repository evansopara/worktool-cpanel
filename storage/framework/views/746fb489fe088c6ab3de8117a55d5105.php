<?php echo e(config('app.name')); ?> — New Notification
==========================================

<?php echo e($notifTitle); ?>


<?php echo e($notifMessage); ?>


<?php if($actionUrl): ?>
Open the app: <?php echo e($actionUrl); ?>

<?php endif; ?>

--
You are receiving this email because an action was taken on your <?php echo e(config('app.name')); ?> account.
If this wasn't you, please ignore this email.
<?php /**PATH /home/wcdigital/workapp/resources/views/emails/notification-text.blade.php ENDPATH**/ ?>